package metadata_test

import (
	"fmt"
	"slices"
	"testing"

	"github.com/mitchellh/copystructure"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
	"pgregory.net/rapid"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/testutils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type modelSecureValue struct {
	*secretv1beta1.SecureValue
	active bool
}

// A simplified model of the grafana secrets manager
type model struct {
	secureValues []*modelSecureValue
}

func newModel() *model {
	return &model{}
}

func (m *model) getNewVersionNumber(namespace, name string) int64 {
	latestVersion := int64(0)
	for _, sv := range m.secureValues {
		if sv.Namespace == namespace && sv.Name == name {
			latestVersion = max(latestVersion, sv.Status.Version)
		}
	}
	return latestVersion + 1
}

func (m *model) setVersionToActive(namespace, name string, version int64) {
	for _, sv := range m.secureValues {
		if sv.Namespace == namespace && sv.Name == name {
			sv.active = sv.Status.Version == version
		}
	}
}

func (m *model) setVersionToInactive(namespace, name string, version int64) {
	for _, sv := range m.secureValues {
		if sv.Namespace == namespace && sv.Name == name && sv.Status.Version == version {
			sv.active = false
			return
		}
	}
}

func (m *model) readActiveVersion(namespace, name string) *modelSecureValue {
	for _, sv := range m.secureValues {
		if sv.Namespace == namespace && sv.Name == name && sv.active {
			return sv
		}
	}

	return nil
}

func (m *model) create(sv *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, error) {
	modelSv := &modelSecureValue{sv, false}
	modelSv.Status.Version = m.getNewVersionNumber(modelSv.Namespace, modelSv.Name)
	modelSv.Status.ExternalID = fmt.Sprintf("%d", modelSv.Status.Version)
	m.secureValues = append(m.secureValues, modelSv)
	m.setVersionToActive(modelSv.Namespace, modelSv.Name, modelSv.Status.Version)
	return modelSv.SecureValue, nil
}

func (m *model) update(newSecureValue *secretv1beta1.SecureValue, actorUID string) (*secretv1beta1.SecureValue, bool, error) {
	// If the payload doesn't contain a value, get the value from current version
	if newSecureValue.Spec.Value == nil {
		sv := m.readActiveVersion(newSecureValue.Namespace, newSecureValue.Name)
		if sv == nil {
			return nil, false, contracts.ErrSecureValueNotFound
		}
		newSecureValue.Spec.Value = sv.Spec.Value
	}
	createdSv, err := m.create(newSecureValue, actorUID)
	return createdSv, true, err
}

func (m *model) delete(namespace, name string) (*secretv1beta1.SecureValue, error) {
	modelSv := m.readActiveVersion(namespace, name)
	if modelSv == nil {
		return nil, contracts.ErrSecureValueNotFound
	}
	m.setVersionToInactive(namespace, name, modelSv.Status.Version)
	return modelSv.SecureValue, nil
}

func (m *model) list(namespace string) (*secretv1beta1.SecureValueList, error) {
	out := make([]secretv1beta1.SecureValue, 0)

	for _, v := range m.secureValues {
		if v.Namespace == namespace && v.active {
			out = append(out, *v.SecureValue)
		}
	}

	return &secretv1beta1.SecureValueList{Items: out}, nil
}

func (m *model) decrypt(decrypter, namespace, name string) (map[string]decrypt.DecryptResult, error) {
	for _, v := range m.secureValues {
		if v.Namespace == namespace &&
			v.Name == name &&
			v.active {
			if slices.ContainsFunc(v.Spec.Decrypters, func(d string) bool { return d == decrypter }) {
				return map[string]decrypt.DecryptResult{
					name: decrypt.NewDecryptResultValue(deepCopy(v).Spec.Value),
				}, nil
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

func (m *model) read(namespace, name string) (*secretv1beta1.SecureValue, error) {
	modelSv := m.readActiveVersion(namespace, name)
	if modelSv == nil {
		return nil, contracts.ErrSecureValueNotFound
	}
	return modelSv.SecureValue, nil
}

var (
	decryptersGen     = rapid.SampledFrom([]string{"svc1", "svc2", "svc3", "svc4", "svc5"})
	nameGen           = rapid.SampledFrom([]string{"n1", "n2", "n3", "n4", "n5"})
	namespaceGen      = rapid.SampledFrom([]string{"ns1", "ns2", "ns3", "ns4", "ns5"})
	anySecureValueGen = rapid.Custom(func(t *rapid.T) *secretv1beta1.SecureValue {
		return &secretv1beta1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name:      nameGen.Draw(t, "name"),
				Namespace: namespaceGen.Draw(t, "ns"),
			},
			Spec: secretv1beta1.SecureValueSpec{
				Description: rapid.SampledFrom([]string{"d1", "d2", "d3", "d4", "d5"}).Draw(t, "description"),
				Value:       ptr.To(secretv1beta1.NewExposedSecureValue(rapid.SampledFrom([]string{"v1", "v2", "v3", "v4", "v5"}).Draw(t, "value"))),
				Decrypters:  rapid.SliceOfDistinct(decryptersGen, func(v string) string { return v }).Draw(t, "decrypters"),
			},
			Status: secretv1beta1.SecureValueStatus{},
		}
	})
	updateSecureValueGen = rapid.Custom(func(t *rapid.T) *secretv1beta1.SecureValue {
		sv := anySecureValueGen.Draw(t, "sv")
		// Maybe update the secret value, maybe not
		if !rapid.Bool().Draw(t, "should_update_value") {
			sv.Spec.Value = nil
		}
		return sv
	})
	// Any secure value will do
	deleteSecureValueGen = anySecureValueGen
	decryptGen           = rapid.Custom(func(t *rapid.T) decryptInput {
		return decryptInput{
			namespace: namespaceGen.Draw(t, "ns"),
			name:      nameGen.Draw(t, "name"),
			decrypter: decryptersGen.Draw(t, "decrypter"),
		}
	})
)

type decryptInput struct {
	namespace string
	name      string
	decrypter string
}

func TestModel(t *testing.T) {
	t.Parallel()

	sv := &secretv1beta1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "sv1",
			Namespace: "ns1",
		},
		Spec: secretv1beta1.SecureValueSpec{
			Description: "desc1",
			Value:       ptr.To(secretv1beta1.NewExposedSecureValue("v1")),
			Decrypters:  []string{"decrypter1"},
		},
		Status: secretv1beta1.SecureValueStatus{},
	}

	t.Run("creating secure values", func(t *testing.T) {
		t.Parallel()

		m := newModel()

		// Create a secure value
		sv1, err := m.create(deepCopy(sv), "actor-uid")
		require.NoError(t, err)
		require.Equal(t, sv.Namespace, sv1.Namespace)
		require.Equal(t, sv.Name, sv1.Name)
		require.EqualValues(t, 1, sv1.Status.Version)

		// Create a new version of a secure value
		sv2, err := m.create(deepCopy(sv), "actor-uid")
		require.NoError(t, err)
		require.Equal(t, sv.Namespace, sv2.Namespace)
		require.Equal(t, sv.Name, sv2.Name)
		require.EqualValues(t, 2, sv2.Status.Version)
	})

	t.Run("updating secure values", func(t *testing.T) {
		t.Parallel()

		m := newModel()

		sv1, err := m.create(deepCopy(sv), "actor-uid")
		require.NoError(t, err)

		// Create a new version of a secure value by updating it
		sv2, _, err := m.update(deepCopy(sv1), "actor-uid")
		require.NoError(t, err)
		require.Equal(t, sv.Namespace, sv2.Namespace)
		require.Equal(t, sv.Name, sv2.Name)
		require.EqualValues(t, 2, sv2.Status.Version)

		// Try updating a secure value that doesn't exist without specifying a value for it
		sv3 := deepCopy(sv2)
		sv3.Name = "i_dont_exist"
		sv3.Spec.Value = nil
		_, _, err = m.update(sv3, "actor-uid")
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)

		// Updating a value that doesn't exist creates a new version
		sv4 := deepCopy(sv3)
		sv4.Name = "i_dont_exist"
		sv4.Spec.Value = ptr.To(secretv1beta1.NewExposedSecureValue("sv4"))
		sv4, _, err = m.update(sv4, "actor-uid")
		require.NoError(t, err)
		require.EqualValues(t, 1, sv4.Status.Version)
	})

	t.Run("deleting a secure value", func(t *testing.T) {
		t.Parallel()

		m := newModel()

		sv1, err := m.create(deepCopy(sv), "actor-uid")
		require.NoError(t, err)

		// Deleting a secure value
		deletedSv, err := m.delete(sv1.Namespace, sv1.Name)
		require.NoError(t, err)
		require.Equal(t, sv1.Namespace, deletedSv.Namespace)
		require.Equal(t, sv1.Name, deletedSv.Name)
		require.EqualValues(t, sv1.Status.Version, deletedSv.Status.Version)

		// Deleting a secure value that doesn't exist results in an error
		_, err = m.delete(sv1.Namespace, sv1.Name)
		require.ErrorIs(t, err, contracts.ErrSecureValueNotFound)
	})

	t.Run("listing secure values", func(t *testing.T) {
		t.Parallel()

		m := newModel()

		// No secure values exist yet
		list, err := m.list(sv.Namespace)
		require.NoError(t, err)
		require.Equal(t, 0, len(list.Items))

		// Create a secure value
		sv1, err := m.create(deepCopy(sv), "actor-uid")
		require.NoError(t, err)

		// 1 secure value exists and it should be returned
		list, err = m.list(sv.Namespace)
		require.NoError(t, err)
		require.Equal(t, 1, len(list.Items))
		require.Equal(t, sv1.Namespace, list.Items[0].Namespace)
		require.Equal(t, sv1.Name, list.Items[0].Name)
		require.EqualValues(t, sv1.Status.Version, list.Items[0].Status.Version)
	})

	t.Run("decrypting secure values", func(t *testing.T) {
		t.Parallel()

		m := newModel()

		// Decrypting a secure value that does not exist
		result, err := m.decrypt("decrypter", "namespace", "name")
		require.NoError(t, err)
		require.Equal(t, 1, len(result))
		require.Nil(t, result["name"].Value())
		require.ErrorIs(t, result["name"].Error(), contracts.ErrDecryptNotFound)

		// Create a secure value
		secret := "v1"
		sv1, err := m.create(deepCopy(sv), "actor-uid")
		require.NoError(t, err)

		// Decrypt the just created secure value
		result, err = m.decrypt(sv1.Spec.Decrypters[0], sv1.Namespace, sv1.Name)
		require.NoError(t, err)
		require.Equal(t, 1, len(result))
		require.Nil(t, result[sv1.Name].Error())
		require.Equal(t, secret, result[sv1.Name].Value().DangerouslyExposeAndConsumeValue())
	})
}

func TestStateMachine(t *testing.T) {
	t.Parallel()

	tt := t

	rapid.Check(t, func(t *rapid.T) {
		sut := testutils.Setup(tt)
		model := newModel()

		t.Repeat(map[string]func(*rapid.T){
			"create": func(t *rapid.T) {
				sv := anySecureValueGen.Draw(t, "sv")

				modelCreatedSv, modelErr := model.create(deepCopy(sv), "actor-uid")

				createdSv, err := sut.CreateSv(t.Context(), testutils.CreateSvWithSv(deepCopy(sv)))
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelCreatedSv.Namespace, createdSv.Namespace)
				require.Equal(t, modelCreatedSv.Name, createdSv.Name)
				require.Equal(t, modelCreatedSv.Status.Version, createdSv.Status.Version)
			},
			"update": func(t *rapid.T) {
				sv := updateSecureValueGen.Draw(t, "sv")
				modelCreatedSv, _, modelErr := model.update(deepCopy(sv), "actor-uid")
				createdSv, err := sut.UpdateSv(t.Context(), deepCopy(sv))
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelCreatedSv.Namespace, createdSv.Namespace)
				require.Equal(t, modelCreatedSv.Name, createdSv.Name)
				require.Equal(t, modelCreatedSv.Status.Version, createdSv.Status.Version)
			},
			"delete": func(t *rapid.T) {
				sv := deleteSecureValueGen.Draw(t, "sv")
				modelSv, modelErr := model.delete(sv.Namespace, sv.Name)
				deletedSv, err := sut.DeleteSv(t.Context(), sv.Namespace, sv.Name)
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelSv.Namespace, deletedSv.Namespace)
				require.Equal(t, modelSv.Name, deletedSv.Name)
				require.Equal(t, modelSv.Status.Version, deletedSv.Status.Version)
			},
			"list": func(t *rapid.T) {
				sv := anySecureValueGen.Draw(t, "sv")
				authCtx := testutils.CreateUserAuthContext(t.Context(), sv.Namespace, map[string][]string{
					"securevalues:read": {"securevalues:uid:*"},
				})
				modelList, modelErr := model.list(sv.Namespace)
				list, err := sut.SecureValueService.List(authCtx, xkube.Namespace(sv.Namespace))
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}

				require.Equal(t, len(modelList.Items), len(list.Items))

				// PERFORMANCE: The lists are always small
				for _, v1 := range modelList.Items {
					if !slices.ContainsFunc(list.Items, func(v2 secretv1beta1.SecureValue) bool {
						return v2.Namespace == v1.Namespace && v2.Name == v1.Name && v2.Status.Version == v1.Status.Version
					}) {
						t.Fatalf("expected sut to return secure value ns=%+v name=%+v version=%+v in the result", v1.Namespace, v1.Name, v1.Status.Version)
					}
				}
			},
			"get": func(t *rapid.T) {
				sv := anySecureValueGen.Draw(t, "sv")
				modelSv, modelErr := model.read(sv.Namespace, sv.Name)
				readSv, err := sut.SecureValueService.Read(t.Context(), xkube.Namespace(sv.Namespace), sv.Name)
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}
				require.Equal(t, modelSv.Namespace, readSv.Namespace)
				require.Equal(t, modelSv.Name, readSv.Name)
				require.Equal(t, modelSv.Status.Version, readSv.Status.Version)
			},
			"decrypt": func(t *rapid.T) {
				input := decryptGen.Draw(t, "decryptInput")
				modelResult, modelErr := model.decrypt(input.decrypter, input.namespace, input.name)
				result, err := sut.DecryptService.Decrypt(t.Context(), input.decrypter, input.namespace, input.name)
				if err != nil || modelErr != nil {
					require.ErrorIs(t, err, modelErr)
					return
				}

				require.Equal(t, len(modelResult), len(result))
				for name := range modelResult {
					require.Equal(t, modelResult[name].Value(), result[name].Value())
					require.Equal(t, modelResult[name].Error(), result[name].Error())
				}
			},
		})
	})
}

func TestSecureValueServiceExampleBased(t *testing.T) {
	t.Parallel()

	t.Run("shouldn't be able to decrypt using deleted secure value", func(t *testing.T) {
		t.Parallel()

		sut := testutils.Setup(t)

		sv, err := sut.CreateSv(t.Context())
		require.NoError(t, err)

		readSv, err := sut.SecureValueService.Read(t.Context(), xkube.Namespace(sv.Namespace), sv.Name)
		require.NoError(t, err)
		require.Equal(t, sv.Status.Version, readSv.Status.Version)

		deletedSv, err := sut.DeleteSv(t.Context(), sv.Namespace, sv.Name)
		require.NoError(t, err)
		require.Equal(t, sv.Status.Version, deletedSv.Status.Version)

		result, err := sut.DecryptService.Decrypt(t.Context(), sv.Spec.Decrypters[0], sv.Namespace, sv.Name)
		require.NoError(t, err)
		require.Equal(t, 1, len(result))
		require.ErrorIs(t, result[sv.Name].Error(), contracts.ErrDecryptNotFound)
	})
}

func deepCopy[T any](sv T) T {
	copied, err := copystructure.Copy(sv)
	if err != nil {
		panic(fmt.Sprintf("failed to copy secure value: %v", err))
	}
	return copied.(T)
}
