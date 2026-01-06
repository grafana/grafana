package testutils

import (
	"context"
	"fmt"
	"slices"
	"time"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

type ModelSecureValue struct {
	*secretv1beta1.SecureValue
	active       bool
	created      time.Time
	leaseCreated time.Time
}

type ModelKeeper struct {
	namespace  string
	name       string
	active     bool
	keeperType secretv1beta1.KeeperType
}

// A simplified in memoruy model of the grafana secrets manager
type ModelGsm struct {
	SecureValues        []*ModelSecureValue
	Keepers             []*ModelKeeper
	modelSecretsManager *ModelAWSSecretsManager
}

func NewModelGsm(modelSecretsManager *ModelAWSSecretsManager) *ModelGsm {
	return &ModelGsm{modelSecretsManager: modelSecretsManager}
}

func (m *ModelGsm) getNewVersionNumber(namespace, name string) int64 {
	latestVersion := int64(0)
	for _, sv := range m.SecureValues {
		if sv.Namespace == namespace && sv.Name == name {
			latestVersion = max(latestVersion, sv.Status.Version)
		}
	}
	return latestVersion + 1
}

func (m *ModelGsm) SetVersionToActive(namespace, name string, version int64) {
	for _, sv := range m.SecureValues {
		if sv.Namespace == namespace && sv.Name == name {
			sv.active = sv.Status.Version == version
		}
	}
}

func (m *ModelGsm) SetVersionToInactive(namespace, name string, version int64) {
	for _, sv := range m.SecureValues {
		if sv.Namespace == namespace && sv.Name == name && sv.Status.Version == version {
			sv.active = false
			return
		}
	}
}

func (m *ModelGsm) ReadActiveVersion(namespace, name string) *ModelSecureValue {
	for _, sv := range m.SecureValues {
		if sv.Namespace == namespace && sv.Name == name && sv.active {
			return sv
		}
	}

	return nil
}

func (m *ModelGsm) Create(now time.Time, sv *secretv1beta1.SecureValue) (*secretv1beta1.SecureValue, error) {
	keeper := m.getActiveKeeper(sv.Namespace)

	if sv.Spec.Ref != nil && keeper.keeperType == secretv1beta1.SystemKeeperType {
		return nil, contracts.ErrReferenceWithSystemKeeper
	}

	sv = sv.DeepCopy()

	// Preserve the original creation time if this secure value already exists
	created := now
	if sv := m.ReadActiveVersion(sv.Namespace, sv.Name); sv != nil {
		created = sv.created
	}

	modelSv := &ModelSecureValue{SecureValue: sv, active: false, created: created}
	modelSv.Status.Version = m.getNewVersionNumber(modelSv.Namespace, modelSv.Name)
	modelSv.Status.ExternalID = fmt.Sprintf("%d", modelSv.Status.Version)
	modelSv.Status.Keeper = keeper.name
	m.SecureValues = append(m.SecureValues, modelSv)
	m.SetVersionToActive(modelSv.Namespace, modelSv.Name, modelSv.Status.Version)
	return modelSv.SecureValue, nil
}

func (m *ModelGsm) getActiveKeeper(namespace string) *ModelKeeper {
	for _, k := range m.Keepers {
		if k.namespace == namespace && k.active {
			return k
		}
	}

	// Default to the system keeper when there are no active keepers in the namespace
	return &ModelKeeper{
		namespace:  namespace,
		name:       contracts.SystemKeeperName,
		active:     true,
		keeperType: secretv1beta1.SystemKeeperType,
	}
}

func (m *ModelGsm) keeperExists(namespace, name string) bool {
	return m.findKeeper(namespace, name) != nil
}

func (m *ModelGsm) findKeeper(namespace, name string) *ModelKeeper {
	// The system keeper is not in the list of keepers
	if name == contracts.SystemKeeperName {
		return &ModelKeeper{namespace: namespace, name: contracts.SystemKeeperName, active: true, keeperType: secretv1beta1.SystemKeeperType}
	}
	for _, k := range m.Keepers {
		if k.namespace == namespace && k.name == name {
			return k
		}
	}
	return nil
}

func (m *ModelGsm) CreateKeeper(keeper *secretv1beta1.Keeper) (*secretv1beta1.Keeper, error) {
	if m.keeperExists(keeper.Namespace, keeper.Name) {
		return nil, contracts.ErrKeeperAlreadyExists
	}

	var keeperType secretv1beta1.KeeperType
	switch {
	case keeper.Spec.Aws != nil:
		keeperType = secretv1beta1.AWSKeeperType
	case keeper.Spec.Gcp != nil:
		keeperType = secretv1beta1.GCPKeeperType
	case keeper.Spec.Azure != nil:
		keeperType = secretv1beta1.AzureKeeperType
	case keeper.Spec.HashiCorpVault != nil:
		keeperType = secretv1beta1.HashiCorpKeeperType
	default:
		keeperType = secretv1beta1.SystemKeeperType
	}

	m.Keepers = append(m.Keepers, &ModelKeeper{namespace: keeper.Namespace, name: keeper.Name, keeperType: keeperType})

	return keeper.DeepCopy(), nil
}

func (m *ModelGsm) SetKeeperAsActive(namespace, keeperName string) error {
	// Set every other keeper in the namespace as inactive
	for _, k := range m.Keepers {
		if k.namespace == namespace {
			k.active = k.name == keeperName
		}
	}

	return nil
}

func (m *ModelGsm) Update(now time.Time, newSecureValue *secretv1beta1.SecureValue) (*secretv1beta1.SecureValue, bool, error) {
	sv := m.ReadActiveVersion(newSecureValue.Namespace, newSecureValue.Name)
	if sv == nil {
		return nil, false, contracts.ErrSecureValueNotFound
	}

	// If the keeper doesn't exist, return an error
	if !m.keeperExists(sv.Namespace, sv.Status.Keeper) {
		return nil, false, contracts.ErrKeeperNotFound
	}

	// If the payload doesn't contain a value and it's not using a reference, get the value from current version
	if newSecureValue.Spec.Value == nil && newSecureValue.Spec.Ref == nil {
		// Tried to update a secure value without providing a new value or a ref
		if sv.Spec.Value == nil {
			return nil, false, contracts.ErrSecureValueMissingSecretAndRef
		}
		newSecureValue.Spec.Value = sv.Spec.Value
	}

	createdSv, err := m.Create(now, newSecureValue)

	return createdSv, true, err
}

func (m *ModelGsm) Delete(namespace, name string) (*secretv1beta1.SecureValue, error) {
	modelSv := m.ReadActiveVersion(namespace, name)
	if modelSv == nil {
		return nil, contracts.ErrSecureValueNotFound
	}
	m.SetVersionToInactive(namespace, name, modelSv.Status.Version)
	return modelSv.SecureValue, nil
}

func (m *ModelGsm) List(namespace string) (*secretv1beta1.SecureValueList, error) {
	out := make([]secretv1beta1.SecureValue, 0)

	for _, v := range m.SecureValues {
		if v.Namespace == namespace && v.active {
			out = append(out, *v.SecureValue)
		}
	}

	return &secretv1beta1.SecureValueList{Items: out}, nil
}

func (m *ModelGsm) Decrypt(ctx context.Context, decrypter, namespace, name string) (map[string]decrypt.DecryptResult, error) {
	for _, v := range m.SecureValues {
		if v.Namespace == namespace &&
			v.Name == name &&
			v.active {
			if slices.ContainsFunc(v.Spec.Decrypters, func(d string) bool { return d == decrypter }) {
				switch {
				// It's a secure value that specifies the secret
				case v.Spec.Value != nil:
					return map[string]decrypt.DecryptResult{
						name: decrypt.NewDecryptResultValue(v.DeepCopy().Spec.Value),
					}, nil

				// It's a secure value that references a secret on a 3rd party store
				case v.Spec.Ref != nil:
					keeper := m.findKeeper(v.Namespace, v.Status.Keeper)
					switch keeper.keeperType {
					case secretv1beta1.AWSKeeperType:
						exposedValue, err := m.modelSecretsManager.RetrieveReference(ctx, nil, *v.Spec.Ref)
						if err != nil {
							return map[string]decrypt.DecryptResult{
								name: decrypt.NewDecryptResultErr(fmt.Errorf("%w: %w", contracts.ErrDecryptFailed, err)),
							}, nil
						}
						return map[string]decrypt.DecryptResult{
							name: decrypt.NewDecryptResultValue(&exposedValue),
						}, nil

					// Other keepers are not implemented so we default to the system keeper
					default:
						// The system keeper doesn't implement Reference so decryption always fails
						return map[string]decrypt.DecryptResult{
							name: decrypt.NewDecryptResultErr(contracts.ErrDecryptFailed),
						}, nil
					}

				default:
					panic("bug: secure value where Spec.Value and Spec.Ref are nil")
				}
			}

			return map[string]decrypt.DecryptResult{
				name: decrypt.NewDecryptResultErr(contracts.ErrDecryptNotAuthorized),
			}, nil
		}
	}
	return map[string]decrypt.DecryptResult{
		name: decrypt.NewDecryptResultErr(contracts.ErrDecryptNotFound),
	}, nil
}

func (m *ModelGsm) Read(namespace, name string) (*secretv1beta1.SecureValue, error) {
	modelSv := m.ReadActiveVersion(namespace, name)
	if modelSv == nil {
		return nil, contracts.ErrSecureValueNotFound
	}
	return modelSv.SecureValue, nil
}

func (m *ModelGsm) LeaseInactiveSecureValues(now time.Time, minAge, leaseTTL time.Duration, maxBatchSize uint16) ([]*ModelSecureValue, error) {
	out := make([]*ModelSecureValue, 0)

	for _, sv := range m.SecureValues {
		if len(out) >= int(maxBatchSize) {
			break
		}
		if !sv.active && now.Sub(sv.created) > minAge && now.Sub(sv.leaseCreated) > leaseTTL {
			sv.leaseCreated = now
			out = append(out, sv)
		}
	}

	return out, nil
}

func (m *ModelGsm) CleanupInactiveSecureValues(now time.Time, minAge time.Duration, maxBatchSize uint16) ([]*ModelSecureValue, error) {
	// Using a slice to allow duplicates
	toDelete := make([]*ModelSecureValue, 0)

	// The implementation query sorts by created time ascending
	slices.SortFunc(m.SecureValues, func(a, b *ModelSecureValue) int {
		if a.created.Before(b.created) {
			return -1
		} else if a.created.After(b.created) {
			return 1
		}
		return 0
	})

	for _, sv := range m.SecureValues {
		if len(toDelete) >= int(maxBatchSize) {
			break
		}

		if !sv.active && now.Sub(sv.created) > minAge {
			toDelete = append(toDelete, sv)
		}
	}

	// PERF: The slices are always small
	m.SecureValues = slices.DeleteFunc(m.SecureValues, func(v1 *ModelSecureValue) bool {
		return slices.ContainsFunc(toDelete, func(v2 *ModelSecureValue) bool {
			return v2.UID == v1.UID
		})
	})

	return toDelete, nil
}
