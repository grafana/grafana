package reststorage

import (
	"context"
	"errors"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

var (
	_ rest.Scoper               = (*KeeperRest)(nil)
	_ rest.SingularNameProvider = (*KeeperRest)(nil)
	_ rest.Getter               = (*KeeperRest)(nil)
	_ rest.Lister               = (*KeeperRest)(nil)
	_ rest.Storage              = (*KeeperRest)(nil)
	_ rest.Creater              = (*KeeperRest)(nil)
	_ rest.Updater              = (*KeeperRest)(nil)
	_ rest.GracefulDeleter      = (*KeeperRest)(nil)
)

// KeeperRest is an implementation of CRUDL operations on a `keeper` backed by TODO.
type KeeperRest struct {
	storage        contracts.KeeperMetadataStorage
	resource       utils.ResourceInfo
	tableConverter rest.TableConvertor
}

// NewKeeperRest is a returns a constructed `*KeeperRest`.
func NewKeeperRest(storage contracts.KeeperMetadataStorage, resource utils.ResourceInfo) *KeeperRest {
	return &KeeperRest{storage, resource, resource.TableConverter()}
}

// New returns an empty `*Keeper` that is used by the `Create` method.
func (s *KeeperRest) New() runtime.Object {
	return s.resource.NewFunc()
}

// Destroy is called when? [TODO]
func (s *KeeperRest) Destroy() {}

// NamespaceScoped returns `true` because the storage is namespaced (== org).
func (s *KeeperRest) NamespaceScoped() bool {
	return true
}

// GetSingularName is used by `kubectl` discovery to have singular name representation of resources.
func (s *KeeperRest) GetSingularName() string {
	return s.resource.GetSingularName()
}

// NewList returns an empty `*KeeperList` that is used by the `List` method.
func (s *KeeperRest) NewList() runtime.Object {
	return s.resource.NewListFunc()
}

// ConvertToTable is used by Kubernetes and converts objects to `metav1.Table`.
func (s *KeeperRest) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

// List calls the inner `store` (persistence) and returns a list of `Keepers` within a `namespace` filtered by the `options`.
func (s *KeeperRest) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	keepersList, err := s.storage.List(ctx, xkube.Namespace(namespace), options)
	if err != nil {
		return nil, fmt.Errorf("failed to list keepers: %w", err)
	}

	return keepersList, nil
}

// Get calls the inner `store` (persistence) and returns a `Keeper` by `name`.
func (s *KeeperRest) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing namespace")
	}

	kp, err := s.storage.Read(ctx, xkube.Namespace(namespace), name)
	if err != nil {
		if errors.Is(err, contracts.ErrKeeperNotFound) {
			return nil, s.resource.NewNotFound(name)
		}
		return nil, fmt.Errorf("failed to read keeper: %w", err)
	}

	return kp, nil
}

// Create a new `Keeper`. Does some validation and allows empty `name` (generated).
func (s *KeeperRest) Create(
	ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	kp, ok := obj.(*secretv0alpha1.Keeper)
	if !ok {
		return nil, fmt.Errorf("expected Keeper for create")
	}

	if err := createValidation(ctx, obj); err != nil {
		return nil, err
	}

	createdKeeper, err := s.storage.Create(ctx, kp)
	if err != nil {
		var kErr xkube.ErrorLister
		if errors.As(err, &kErr) {
			return nil, apierrors.NewInvalid(kp.GroupVersionKind().GroupKind(), kp.Name, kErr.ErrorList())
		}

		return nil, fmt.Errorf("failed to create keeper: %w", err)
	}

	return createdKeeper, nil
}

// Update a `Keeper`'s `value`. The second return parameter indicates whether the resource was newly created.
func (s *KeeperRest) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	oldObj, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	// Makes sure the UID and ResourceVersion are OK.
	// TODO: this also makes it so the labels and annotations are additive, unless we check and remove manually.
	newObj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, fmt.Errorf("k8s updated object: %w", err)
	}

	// The current supported behavior for `Update` is to replace the entire `spec` with the new one.
	// Each provider-specific setting of a keeper lives at the top-level, so it makes it possible to change a provider
	// during an update. Otherwise both old and new providers would be merged in the `newObj` which is not allowed.
	if err := updateValidation(ctx, newObj, oldObj); err != nil {
		return nil, false, err
	}

	newKeeper, ok := newObj.(*secretv0alpha1.Keeper)
	if !ok {
		return nil, false, fmt.Errorf("expected Keeper for update")
	}

	// TODO: do we need to do this here again? Probably not, but double-check!
	newKeeper.Annotations = xkube.CleanAnnotations(newKeeper.Annotations)

	// Current implementation replaces everything passed in the spec, so it is not a PATCH. Do we want/need to support that?
	updatedKeeper, err := s.storage.Update(ctx, newKeeper)
	if err != nil {
		var kErr xkube.ErrorLister
		if errors.As(err, &kErr) {
			return nil, false, apierrors.NewInvalid(newKeeper.GroupVersionKind().GroupKind(), newKeeper.Name, kErr.ErrorList())
		}

		return nil, false, fmt.Errorf("failed to update keeper: %w", err)
	}

	return updatedKeeper, false, nil
}

// Delete calls the inner `store` (persistence) in order to delete the `Keeper`.
// The second return parameter `bool` indicates whether the delete was intant or not. It always is for `Keepers`.
func (s *KeeperRest) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	namespace, ok := request.NamespaceFrom(ctx)
	if !ok {
		return nil, false, fmt.Errorf("missing namespace")
	}

	if err := s.storage.Delete(ctx, xkube.Namespace(namespace), name); err != nil {
		return nil, false, fmt.Errorf("failed to delete keeper: %w", err)
	}

	return nil, true, nil
}

// ValidateKeeper does basic spec validation of a keeper.
func ValidateKeeper(keeper *secretv0alpha1.Keeper, operation admission.Operation) field.ErrorList {
	// Only validate Create and Update for now.
	if operation != admission.Create && operation != admission.Update {
		return nil
	}

	errs := make(field.ErrorList, 0)

	if keeper.Spec.Title == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "title"), "a `title` is required"))
	}

	// Only one keeper type can be configured. Return early and don't validate the specific keeper fields.
	if err := validateKeepers(keeper); err != nil {
		errs = append(errs, err)

		return errs
	}

	// TODO: Improve SQL keeper validation.
	// SQL keeper is not allowed to use `secureValueName` in credentials fields to avoid depending on another keeper.
	if keeper.IsSqlKeeper() {
		if keeper.Spec.SQL.Encryption.AWS != nil {
			if keeper.Spec.SQL.Encryption.AWS.AccessKeyID.SecureValueName != "" {
				errs = append(errs, field.Forbidden(field.NewPath("spec", "aws", "accessKeyId"), "secureValueName cannot be used with SQL keeper"))
			}

			if keeper.Spec.SQL.Encryption.AWS.SecretAccessKey.SecureValueName != "" {
				errs = append(errs, field.Forbidden(field.NewPath("spec", "aws", "secretAccessKey"), "secureValueName cannot be used with SQL keeper"))
			}
		}

		if keeper.Spec.SQL.Encryption.Azure != nil && keeper.Spec.SQL.Encryption.Azure.ClientSecret.SecureValueName != "" {
			errs = append(errs, field.Forbidden(field.NewPath("spec", "azure", "clientSecret"), "secureValueName cannot be used with SQL keeper"))
		}

		if keeper.Spec.SQL.Encryption.HashiCorp != nil && keeper.Spec.SQL.Encryption.HashiCorp.Token.SecureValueName != "" {
			errs = append(errs, field.Forbidden(field.NewPath("spec", "hashicorp", "token"), "secureValueName cannot be used with SQL keeper"))
		}
	}

	if keeper.Spec.AWS != nil {
		if err := validateCredentialValue(field.NewPath("spec", "aws", "accessKeyId"), keeper.Spec.AWS.AccessKeyID); err != nil {
			errs = append(errs, err)
		}

		if err := validateCredentialValue(field.NewPath("spec", "aws", "secretAccessKey"), keeper.Spec.AWS.SecretAccessKey); err != nil {
			errs = append(errs, err)
		}
	}

	if keeper.Spec.Azure != nil {
		if keeper.Spec.Azure.KeyVaultName == "" {
			errs = append(errs, field.Required(field.NewPath("spec", "azure", "keyVaultName"), "a `keyVaultName` is required"))
		}

		if keeper.Spec.Azure.TenantID == "" {
			errs = append(errs, field.Required(field.NewPath("spec", "azure", "tenantId"), "a `tenantId` is required"))
		}

		if keeper.Spec.Azure.ClientID == "" {
			errs = append(errs, field.Required(field.NewPath("spec", "azure", "clientId"), "a `clientId` is required"))
		}

		if err := validateCredentialValue(field.NewPath("spec", "azure", "clientSecret"), keeper.Spec.Azure.ClientSecret); err != nil {
			errs = append(errs, err)
		}
	}

	if keeper.Spec.GCP != nil {
		if keeper.Spec.GCP.ProjectID == "" {
			errs = append(errs, field.Required(field.NewPath("spec", "gcp", "projectId"), "a `projectId` is required"))
		}

		if keeper.Spec.GCP.CredentialsFile == "" {
			errs = append(errs, field.Required(field.NewPath("spec", "gcp", "credentialsFile"), "a `credentialsFile` is required"))
		}
	}

	if keeper.Spec.HashiCorp != nil {
		if keeper.Spec.HashiCorp.Address == "" {
			errs = append(errs, field.Required(field.NewPath("spec", "hashicorp", "address"), "a `address` is required"))
		}

		if err := validateCredentialValue(field.NewPath("spec", "hashicorp", "token"), keeper.Spec.HashiCorp.Token); err != nil {
			errs = append(errs, err)
		}
	}

	return errs
}

func validateKeepers(keeper *secretv0alpha1.Keeper) *field.Error {
	availableKeepers := map[string]bool{
		"sql":       keeper.Spec.SQL != nil,
		"aws":       keeper.Spec.AWS != nil,
		"azure":     keeper.Spec.Azure != nil,
		"gcp":       keeper.Spec.GCP != nil,
		"hashicorp": keeper.Spec.HashiCorp != nil,
	}

	configuredKeepers := make([]string, 0)

	for keeperKind, notNil := range availableKeepers {
		if notNil {
			configuredKeepers = append(configuredKeepers, keeperKind)
		}
	}

	if len(configuredKeepers) == 0 {
		return field.Required(field.NewPath("spec"), "at least one `keeper` must be present")
	}

	if len(configuredKeepers) > 1 {
		return field.Invalid(
			field.NewPath("spec"),
			strings.Join(configuredKeepers, " & "),
			"only one `keeper` can be present at a time but found more",
		)
	}

	return nil
}

func validateCredentialValue(path *field.Path, credentials secretv0alpha1.CredentialValue) *field.Error {
	availableOptions := map[string]bool{
		"secureValueName": credentials.SecureValueName != "",
		"valueFromEnv":    credentials.ValueFromEnv != "",
		"valueFromConfig": credentials.ValueFromConfig != "",
	}

	configuredCredentials := make([]string, 0)

	for credentialKind, notEmpty := range availableOptions {
		if notEmpty {
			configuredCredentials = append(configuredCredentials, credentialKind)
		}
	}

	if len(configuredCredentials) == 0 {
		return field.Required(path, "one of `secureValueName`, `valueFromEnv` or `valueFromConfig` must be present")
	}

	if len(configuredCredentials) > 1 {
		return field.Invalid(
			path,
			strings.Join(configuredCredentials, " & "),
			"only one of `secureValueName`, `valueFromEnv` or `valueFromConfig` must be present at a time but found more",
		)
	}

	return nil
}
