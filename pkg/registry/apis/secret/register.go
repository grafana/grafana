package secret

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/setting"

	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	claims "github.com/grafana/authlib/types"
	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/apiserver/auditing"
	ossreststorage "github.com/grafana/grafana/pkg/registry/apis/secret/reststorage"
	authsvc "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// DependencyRegisterer is set to satisfy wire gen and make sure the `RegisterDependencies` is called.
type DependencyRegisterer struct{}

func RegisterDependencies(
	_ *contracts.SecretDBMigrated,
	accessControlService accesscontrol.Service,
) (*DependencyRegisterer, error) {
	// Permissions for requests in multi-tenant mode will come from HG.
	if err := registerAccessControlRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("registering access control roles: %w", err)
	}

	return &DependencyRegisterer{}, nil
}

// ProvideDatabaseMigrated runs the Secrets Manager migrations. It is separate
// from RegisterDependencies, whose access control dependency would create a
// cycle for services that encrypt while the graph is built, such as the
// embedded NATS server.
func ProvideDatabaseMigrated(cfg *setting.Cfg, secretDBMigrator contracts.SecretDBMigrator) (*contracts.SecretDBMigrated, error) {
	// We shouldn't need to create the DB in HG, as that will use the MT api server.
	if cfg.SecretsManagement.RunSecretsDBMigrations {
		// Some DBs that claim to be MySQL/Postgres-compatible might not support table locking.
		databaseSection := cfg.Raw.Section("database")
		lockDatabase := databaseSection.Key("migration_locking").MustBool(true)
		lockingAttemptTimeoutSec := databaseSection.Key("locking_attempt_timeout_sec").MustInt()

		// This is needed to wire up and run DB migrations for Secrets Manager, which is not run by the generic OSS DB migrator.
		if err := secretDBMigrator.RunMigrations(context.Background(), lockDatabase, lockingAttemptTimeoutSec); err != nil {
			return nil, fmt.Errorf("running secret database migrations: %w", err)
		}
	}

	return &contracts.SecretDBMigrated{}, nil
}

var (
	_ builder.APIGroupBuilder         = (*SecretAPIBuilder)(nil)
	_ builder.APIGroupMutation        = (*SecretAPIBuilder)(nil)
	_ builder.APIGroupValidation      = (*SecretAPIBuilder)(nil)
	_ builder.APIGroupAuthorizer      = (*SecretAPIBuilder)(nil)
	_ builder.APIGroupVersionProvider = (*SecretAPIBuilder)(nil)
)

type SecretAPIBuilder struct {
	tracer               trace.Tracer
	secureValueService   contracts.SecureValueService
	accessClient         claims.AccessClient
	secureValueValidator contracts.SecureValueValidator
	secureValueMutator   contracts.SecureValueMutator
	extension            Extension
}

// Extension is used to augment the api builder from enterprise code
type Extension interface {
	RestStorage() map[string]rest.Storage
	PostProcessOpenAPI(string, string, map[string]*spec3.Path)
	Validate(context.Context, admission.Attributes) (bool, *apierrors.StatusError)
	Mutate(context.Context, admission.Attributes) (bool, error)
	AuthorizerSubresourceHandlers() map[string]authsvc.SubresourceCheck
}

// There are no extensions in OSS by default so use a no-op interface.
type NoopExtension struct{}

func (*NoopExtension) RestStorage() map[string]rest.Storage {
	return nil
}
func (*NoopExtension) PostProcessOpenAPI(string, string, map[string]*spec3.Path) {
	// no-op
}
func (*NoopExtension) Validate(context.Context, admission.Attributes) (bool, *apierrors.StatusError) {
	return false, nil
}
func (*NoopExtension) Mutate(context.Context, admission.Attributes) (bool, error) {
	return false, nil
}
func (*NoopExtension) AuthorizerSubresourceHandlers() map[string]authsvc.SubresourceCheck {
	return make(map[string]authsvc.SubresourceCheck)
}

func ProvideNoopExtension() Extension {
	return &NoopExtension{}
}

func NewSecretAPIBuilder(
	tracer trace.Tracer,
	secureValueService contracts.SecureValueService,
	accessClient claims.AccessClient,
	secureValueValidator contracts.SecureValueValidator,
	secureValueMutator contracts.SecureValueMutator,
	extension Extension,
) *SecretAPIBuilder {
	return &SecretAPIBuilder{
		tracer:               tracer,
		secureValueService:   secureValueService,
		accessClient:         accessClient,
		secureValueValidator: secureValueValidator,
		secureValueMutator:   secureValueMutator,
		extension:            extension,
	}
}

func RegisterAPIService(
	tracer trace.Tracer,
	cfg *setting.Cfg,
	apiregistration builder.APIRegistrar,
	secureValueService contracts.SecureValueService,
	accessClient claims.AccessClient,
	secureValueValidator contracts.SecureValueValidator,
	secureValueMutator contracts.SecureValueMutator,
	extension Extension,
) *SecretAPIBuilder {
	if !cfg.SecretsManagement.RegisterAPIServer {
		return nil
	}

	builder := NewSecretAPIBuilder(
		tracer,
		secureValueService,
		accessClient,
		secureValueValidator,
		secureValueMutator,
		extension,
	)

	apiregistration.RegisterAPI(builder)

	return builder
}

func RegisterAPIServiceForTesting(
	tracer trace.Tracer,
	cfg *setting.Cfg,
	apiregistration builder.APIRegistrar,
	secureValueService contracts.SecureValueService,
	accessClient claims.AccessClient,
	secureValueValidator contracts.SecureValueValidator,
	secureValueMutator contracts.SecureValueMutator,
	extension Extension,
) *SecretAPIBuilder {
	builder := NewSecretAPIBuilder(
		tracer,
		secureValueService,
		accessClient,
		secureValueValidator,
		secureValueMutator,
		extension,
	)

	apiregistration.RegisterAPI(builder)

	return builder
}

// GetGroupVersion returns the tuple of `group` and `version` for the API which uniquely identifies it.
func (b *SecretAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return secretv1beta1.SchemeGroupVersion
}

// InstallSchema is called by the `apiserver` which exposes the defined kinds.
func (b *SecretAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := secretv1beta1.AddKnownTypes(scheme, secretv1beta1.APIVersion)
	if err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	// "no kind is registered for the type"
	err = secretv1beta1.AddKnownTypes(scheme, runtime.APIVersionInternal)
	if err != nil {
		return err
	}

	// Internal Kubernetes metadata API. Presumably to display the available APIs?
	// e.g. http://localhost:3000/apis/secret.grafana.app/v1beta1
	metav1.AddToGroupVersion(scheme, secretv1beta1.SchemeGroupVersion)

	// Register field label conversion for SecureValue to enable custom field selectors
	err = scheme.AddFieldLabelConversionFunc(
		secretv1beta1.SchemeGroupVersion.WithKind("SecureValue"),
		func(label, value string) (string, string, error) {
			// Allow standard metadata fields
			if label == "metadata.name" || label == "metadata.namespace" {
				return label, value, nil
			}
			// Allow our custom field selector
			if label == "spec.decrypter" {
				return label, value, nil
			}
			// Reject unknown field selectors
			return "", "", fmt.Errorf("field label not supported for SecureValue: %s", label)
		},
	)
	if err != nil {
		return fmt.Errorf("failed to add field label conversion: %w", err)
	}

	// This sets the priority in case we have multiple versions.
	// By default Kubernetes will only let you use `kubectl get <resource>` with one version.
	// In case there are multiple versions, we'd need to pass the full path with the `--raw` flag.
	if err := scheme.SetVersionPriority(secretv1beta1.SchemeGroupVersion); err != nil {
		return fmt.Errorf("scheme set version priority: %w", err)
	}

	return nil
}

func (b *SecretAPIBuilder) AllowedV0Alpha1Resources() []string {
	return nil
}

// UpdateAPIGroupInfo is called when creating a generic API server for this group of kinds.
func (b *SecretAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	secureValueResource := secretv1beta1.SecureValuesResourceInfo

	// rest.Storage is a generic interface for RESTful storage services.
	// The constructors need to at least implement this interface, but will most likely implement
	// other interfaces that equal to different operations like `get`, `list` and so on.
	secureRestStorage := map[string]rest.Storage{
		// Default path for `securevalue`.
		// The `reststorage.SecureValueRest` struct will implement interfaces for CRUDL operations on `securevalue`.
		secureValueResource.StoragePath(): ossreststorage.NewSecureValueRest(b.tracer, b.secureValueService, secureValueResource),
	}
	for k, v := range b.extension.RestStorage() {
		secureRestStorage[k] = v
	}

	apiGroupInfo.VersionedResourcesStorageMap[secretv1beta1.APIVersion] = secureRestStorage
	return nil
}

func (b *SecretAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return secretv1beta1.GetOpenAPIDefinitions
}

func (b *SecretAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana Secrets Management"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	smprefix := root + "namespaces/{namespace}"

	defsBase := "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1."

	b.extension.PostProcessOpenAPI(defsBase, smprefix, oas.Paths.Paths)

	sub := oas.Paths.Paths[smprefix+"/securevalues"]
	if sub != nil {
		sub.Post.Description = "create a secure value"

		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: &spec.Schema{
								SchemaProps: spec.SchemaProps{
									Ref: spec.MustCreateRef("#/components/schemas/" + defsBase + "SecureValue"),
								},
							},
							Examples: map[string]*spec3.Example{
								"secret to store in default keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"spec": &secretv1beta1.SecureValueSpec{
													Description: "A secret in default",
													Value:       new(secretv1beta1.NewExposedSecureValue("this is super duper secure")),
													Decrypters:  []string{"k6, synthetic-monitoring"},
												},
											},
										},
									},
								},
								"secret with name specified": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"metadata": metav1.ObjectMeta{
													Name: "xyz",
												},
												"spec": &secretv1beta1.SecureValueSpec{
													Description: "XYZ secret",
													Value:       new(secretv1beta1.NewExposedSecureValue("this is super duper secure")),
													Decrypters:  []string{"k6, synthetic-monitoring"},
												},
											},
										},
									},
								},
							},
						},
					},
					"application/yaml": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema:  spec.MapProperty(nil),
							Example: &unstructured.Unstructured{},
							Examples: map[string]*spec3.Example{
								"secret to store in default keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v1beta1
kind: SecureValue
metadata:
  annotations:
    xx: XXX
    yy: YYY
  labels:
    aa: AAA
    bb: BBB
spec:
  description: A secret value
  value: this is super duper secure
  decrypters:
    - k6 
    - synthetic-monitoring`,
									},
								},
								"secret to store in aws keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v1beta1
kind: SecureValue
metadata:
  annotations:
    xx: XXX
    yy: YYY
  labels:
    aa: AAA
    bb: BBB
spec:
  description: A secret value in aws
  value: this is super duper secure
  decrypters:
    - k6 
    - synthetic-monitoring`,
									},
								},
								"secret to reference in aws keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v1beta1
kind: SecureValue
metadata:
  annotations:
    xx: XXX
    yy: YYY
  labels:
    aa: AAA
    bb: BBB
spec:
  description: A secret from aws
  ref: my-secret-in-aws
  decrypters:
    - k6`,
									},
								},
								"secret with name specified": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v1beta1
kind: SecureValue
metadata:
  name: xyz
  annotations:
    xx: XXX
    yy: YYY
  labels:
    aa: AAA
    bb: BBB
spec:
  description: XYZ secret
  value: this is super duper secure
  decrypters:
    - k6 
    - synthetic-monitoring`,
									},
								},
							},
						},
					},
				},
			},
		}

		sub.Post.Responses.StatusCodeResponses[400] = createOpenAPIStatusResponse(metav1.StatusReasonBadRequest)
		sub.Post.Responses.StatusCodeResponses[403] = createOpenAPIStatusResponse(metav1.StatusReasonForbidden)
		sub.Post.Responses.StatusCodeResponses[409] = createOpenAPIStatusResponse(metav1.StatusReasonAlreadyExists)
		sub.Post.Responses.StatusCodeResponses[422] = createOpenAPIStatusResponse(metav1.StatusReasonInvalid)
		sub.Post.Responses.StatusCodeResponses[500] = createOpenAPIStatusResponse(metav1.StatusReasonInternalError)

		sub.Get.Responses.StatusCodeResponses[403] = createOpenAPIStatusResponse(metav1.StatusReasonForbidden)
		sub.Get.Responses.StatusCodeResponses[404] = createOpenAPIStatusResponse(metav1.StatusReasonNotFound)
		sub.Get.Responses.StatusCodeResponses[500] = createOpenAPIStatusResponse(metav1.StatusReasonInternalError)
	}

	if namedPath := oas.Paths.Paths[smprefix+"/securevalues/{name}"]; namedPath != nil {
		if namedPath.Get != nil {
			namedPath.Get.Responses.StatusCodeResponses[403] = createOpenAPIStatusResponse(metav1.StatusReasonForbidden)
			namedPath.Get.Responses.StatusCodeResponses[404] = createOpenAPIStatusResponse(metav1.StatusReasonNotFound)
			namedPath.Get.Responses.StatusCodeResponses[500] = createOpenAPIStatusResponse(metav1.StatusReasonInternalError)
		}

		if namedPath.Put != nil {
			namedPath.Put.Responses.StatusCodeResponses[400] = createOpenAPIStatusResponse(metav1.StatusReasonBadRequest)
			namedPath.Put.Responses.StatusCodeResponses[403] = createOpenAPIStatusResponse(metav1.StatusReasonForbidden)
			namedPath.Put.Responses.StatusCodeResponses[404] = createOpenAPIStatusResponse(metav1.StatusReasonNotFound)
			namedPath.Put.Responses.StatusCodeResponses[422] = createOpenAPIStatusResponse(metav1.StatusReasonInvalid)
			namedPath.Put.Responses.StatusCodeResponses[500] = createOpenAPIStatusResponse(metav1.StatusReasonInternalError)
		}

		if namedPath.Delete != nil {
			createResponse := sub.Post.Responses.StatusCodeResponses[200]

			namedPath.Delete.Responses.StatusCodeResponses[200] = createResponse
			namedPath.Delete.Responses.StatusCodeResponses[202] = createResponse
			namedPath.Delete.Responses.StatusCodeResponses[403] = createOpenAPIStatusResponse(metav1.StatusReasonForbidden)
			namedPath.Delete.Responses.StatusCodeResponses[404] = createOpenAPIStatusResponse(metav1.StatusReasonNotFound)
			namedPath.Delete.Responses.StatusCodeResponses[500] = createOpenAPIStatusResponse(metav1.StatusReasonInternalError)
		}
	}

	return oas, nil
}

// GetAuthorizer decides whether the request is allowed, denied or no opinion based on credentials and request attributes.
// Usually most resource are stored in folders (e.g. alerts, dashboards), which allows users to manage permissions at folder level,
// rather than at resource level which also has the benefit of lowering the load on AuthZ side, since instead of storing access to
// a single dashboard, you'd store access to all dashboards in a specific folder.
// For Secrets, this is not the case, but if we want to make it so, we need to update this ResourceAuthorizer to check the containing folder.
// If we ever want to do that, get guidance from IAM first as well.
func (b *SecretAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	subresourceHandlers := b.extension.AuthorizerSubresourceHandlers()
	return authsvc.NewResourceAuthorizerWithSubresourceHandlers(b.accessClient, subresourceHandlers)
}

// Validate is called in `Create`, `Update` and `Delete` REST funcs, if the body calls the argument `rest.ValidateObjectFunc`.
func (b *SecretAPIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	_, span := b.tracer.Start(ctx, "SecretAPIBuilder.Validate")
	defer span.End()

	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
		}
	}()

	obj := a.GetObject()
	operation := a.GetOperation()

	if obj == nil || operation == admission.Connect {
		return nil // This is normal for sub-resource
	}

	groupKind := obj.GetObjectKind().GroupVersionKind().GroupKind()

	// Generic validations for all kinds. At this point the name+namespace must not be empty.
	if a.GetName() == "" {
		return apierrors.NewInvalid(
			groupKind,
			a.GetName(),
			field.ErrorList{field.Required(field.NewPath("metadata", "name"), "a `name` is required")},
		)
	}

	if a.GetNamespace() == "" {
		return apierrors.NewInvalid(
			groupKind,
			a.GetName(),
			field.ErrorList{field.Required(field.NewPath("metadata", "namespace"), "a `namespace` is required")},
		)
	}

	switch typedObj := obj.(type) {
	case *secretv1beta1.SecureValue:
		var oldObj *secretv1beta1.SecureValue

		if a.GetOldObject() != nil {
			var ok bool

			oldObj, ok = a.GetOldObject().(*secretv1beta1.SecureValue)
			if !ok {
				return apierrors.NewBadRequest(fmt.Sprintf("old object is not a SecureValue, found %T", a.GetOldObject()))
			}
		}

		if errs := b.secureValueValidator.Validate(typedObj, oldObj, operation); len(errs) > 0 {
			return apierrors.NewInvalid(groupKind, a.GetName(), errs)
		}

		return nil
	}

	if ok, err := b.extension.Validate(ctx, a); ok {
		if err != nil {
			return err
		}
		return nil
	}

	return apierrors.NewBadRequest(fmt.Sprintf("unknown spec %T", obj))
}

func (b *SecretAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	_, span := b.tracer.Start(ctx, "SecretAPIBuilder.Mutate")
	defer span.End()

	defer func() {
		if err != nil {
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
		}
	}()

	obj := a.GetObject()
	operation := a.GetOperation()

	if obj == nil || operation == admission.Connect {
		return nil // This is normal for sub-resource
	}

	switch typedObj := obj.(type) {
	case *secretv1beta1.SecureValue:
		return b.secureValueMutator.Mutate(typedObj, operation)
	}

	if ok, err := b.extension.Mutate(ctx, a); ok {
		return err
	}

	return apierrors.NewBadRequest(fmt.Sprintf("unknown spec %T", obj))
}

// GetPolicyRuleEvaluator sets the auditLog PolicyRuleEvaluator for the Secrets API
func (b *SecretAPIBuilder) GetPolicyRuleEvaluator() auditing.PolicyRuleEvaluator {
	return auditing.NewDefaultGrafanaPolicyRuleEvaluator()
}

func createOpenAPIStatusResponse(statusReason metav1.StatusReason) *spec3.Response {
	return &spec3.Response{
		ResponseProps: spec3.ResponseProps{
			Content: map[string]*spec3.MediaType{
				"application/json": {
					MediaTypeProps: spec3.MediaTypeProps{
						Schema: &spec.Schema{
							SchemaProps: spec.SchemaProps{
								Ref: spec.MustCreateRef("#/components/schemas/io.k8s.apimachinery.pkg.apis.meta.v1.Status"),
							},
						},
					},
				},
			},
			Description: string(statusReason),
		},
	}
}
