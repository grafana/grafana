package secret

import (
	"context"
	"errors"
	"fmt"
	"time"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
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

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/reststorage"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/registry/apis/secret/worker"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	authsvc "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	_ builder.APIGroupBuilder               = (*SecretAPIBuilder)(nil)
	_ builder.APIGroupMutation              = (*SecretAPIBuilder)(nil)
	_ builder.APIGroupValidation            = (*SecretAPIBuilder)(nil)
	_ builder.APIGroupPostStartHookProvider = (*SecretAPIBuilder)(nil)
)

type SecretAPIBuilder struct {
	tracer                     tracing.Tracer
	secretService              *service.SecretService
	secureValueMetadataStorage contracts.SecureValueMetadataStorage
	keeperMetadataStorage      contracts.KeeperMetadataStorage
	secretsOutboxQueue         contracts.OutboxQueue
	database                   contracts.Database
	accessClient               claims.AccessClient
	worker                     *worker.Worker
	decryptersAllowList        map[string]struct{}
}

func NewSecretAPIBuilder(
	tracer tracing.Tracer,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	secretService *service.SecretService,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	secretsOutboxQueue contracts.OutboxQueue,
	database contracts.Database,
	keeperService contracts.KeeperService,
	accessClient claims.AccessClient,
	decryptersAllowList map[string]struct{},
) (*SecretAPIBuilder, error) {
	return &SecretAPIBuilder{
		tracer:                     tracer,
		secretService:              secretService,
		secureValueMetadataStorage: secureValueMetadataStorage,
		keeperMetadataStorage:      keeperMetadataStorage,
		secretsOutboxQueue:         secretsOutboxQueue,
		database:                   database,
		accessClient:               accessClient,
		worker: worker.NewWorker(worker.Config{
			BatchSize:      1,
			ReceiveTimeout: 5 * time.Second,
		},
			database,
			secretsOutboxQueue,
			secureValueMetadataStorage,
			keeperMetadataStorage,
			keeperService,
		),
		decryptersAllowList: decryptersAllowList,
	}, nil
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	cfg *setting.Cfg,
	apiregistration builder.APIRegistrar,
	tracer tracing.Tracer,
	secureValueMetadataStorage contracts.SecureValueMetadataStorage,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	outboxQueue contracts.OutboxQueue,
	secretService *service.SecretService,
	database contracts.Database,
	keeperService contracts.KeeperService,
	accessClient claims.AccessClient,
	accessControlService accesscontrol.Service,
	secretDBMigrator contracts.SecretDBMigrator,
) (*SecretAPIBuilder, error) {
	// Skip registration unless opting into experimental apis and the secrets management app platform flag.
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return nil, nil
	}

	if err := secretDBMigrator.RunMigrations(); err != nil {
		return nil, fmt.Errorf("running secret database migrations: %w", err)
	}

	if err := RegisterAccessControlRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("register secret access control roles: %w", err)
	}

	builder, err := NewSecretAPIBuilder(
		tracer,
		secureValueMetadataStorage,
		secretService,
		keeperMetadataStorage,
		outboxQueue,
		database,
		keeperService,
		accessClient,
		nil, // OSS does not need an allow list.
	)
	if err != nil {
		return builder, fmt.Errorf("calling NewSecretAPIBuilder: %+w", err)
	}

	apiregistration.RegisterAPI(builder)

	return builder, nil
}

// GetGroupVersion returns the tuple of `group` and `version` for the API which uniquely identifies it.
func (b *SecretAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return secretv0alpha1.SchemeGroupVersion
}

// InstallSchema is called by the `apiserver` which exposes the defined kinds.
func (b *SecretAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := secretv0alpha1.AddKnownTypes(scheme, secretv0alpha1.VERSION)
	if err != nil {
		return err
	}

	// Link this version to the internal representation.
	// This is used for server-side-apply (PATCH), and avoids the error:
	// "no kind is registered for the type"
	err = secretv0alpha1.AddKnownTypes(scheme, runtime.APIVersionInternal)
	if err != nil {
		return err
	}

	// Internal Kubernetes metadata API. Presumably to display the available APIs?
	// e.g. http://localhost:3000/apis/secret.grafana.app/v0alpha1
	metav1.AddToGroupVersion(scheme, secretv0alpha1.SchemeGroupVersion)

	// This sets the priority in case we have multiple versions.
	// By default Kubernetes will only let you use `kubectl get <resource>` with one version.
	// In case there are multiple versions, we'd need to pass the full path with the `--raw` flag.
	if err := scheme.SetVersionPriority(secretv0alpha1.SchemeGroupVersion); err != nil {
		return fmt.Errorf("scheme set version priority: %w", err)
	}

	return nil
}

// UpdateAPIGroupInfo is called when creating a generic API server for this group of kinds.
func (b *SecretAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	secureValueResource := secretv0alpha1.SecureValuesResourceInfo
	keeperResource := secretv0alpha1.KeeperResourceInfo

	// rest.Storage is a generic interface for RESTful storage services.
	// The constructors need to at least implement this interface, but will most likely implement
	// other interfaces that equal to different operations like `get`, `list` and so on.
	secureRestStorage := map[string]rest.Storage{
		// Default path for `securevalue`.
		// The `reststorage.SecureValueRest` struct will implement interfaces for CRUDL operations on `securevalue`.
		secureValueResource.StoragePath(): reststorage.NewSecureValueRest(b.secretService, secureValueResource),

		// The `reststorage.KeeperRest` struct will implement interfaces for CRUDL operations on `keeper`.
		keeperResource.StoragePath(): reststorage.NewKeeperRest(b.keeperMetadataStorage, b.accessClient, keeperResource),
	}

	apiGroupInfo.VersionedResourcesStorageMap[secretv0alpha1.VERSION] = secureRestStorage
	return nil
}

// GetOpenAPIDefinitions, is this only for documentation?
func (b *SecretAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return secretv0alpha1.GetOpenAPIDefinitions
}

// PostProcessOpenAPI modifies the OpenAPI spec by adding examples and descriptions.
func (b *SecretAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Grafana Secrets Management"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	smprefix := root + "namespaces/{namespace}"

	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	defsBase := "github.com/grafana/grafana/pkg/apis/secret/v0alpha1."

	// Create Keepers path
	sub := oas.Paths.Paths[smprefix+"/keepers"]
	if sub != nil {
		optionsSchema := defs[defsBase+"KeeperSpec"].Schema
		sub.Post.Description = "create a secret keeper"
		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: &optionsSchema,
							Examples: map[string]*spec3.Example{
								"an aws keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"spec": &secretv0alpha1.KeeperSpec{
													Description: "AWS XYZ Keeper",
													AWS: &secretv0alpha1.AWSKeeperConfig{
														AWSCredentials: secretv0alpha1.AWSCredentials{
															AccessKeyID: secretv0alpha1.CredentialValue{
																ValueFromEnv: "AWS_ACCESS_KEY_ID",
															},
															SecretAccessKey: secretv0alpha1.CredentialValue{
																ValueFromEnv: "AWS_SECRET_ACCESS_KEY",
															},
															KMSKeyID: "kms-key-id",
														},
													},
												},
											},
										},
									},
								},
								"an azure keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"spec": &secretv0alpha1.KeeperSpec{
													Description: "Azure XYZ Keeper",
													Azure: &secretv0alpha1.AzureKeeperConfig{
														AzureCredentials: secretv0alpha1.AzureCredentials{
															KeyVaultName: "key-vault-name",
															TenantID:     "tenant-id",
															ClientID:     "client-id",
															ClientSecret: secretv0alpha1.CredentialValue{
																ValueFromConfig: "/path/to/file.json",
															},
														},
													},
												},
											},
										},
									},
								},
								"a gcp keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"spec": &secretv0alpha1.KeeperSpec{
													Description: "GCP XYZ Keeper",
													GCP: &secretv0alpha1.GCPKeeperConfig{
														GCPCredentials: secretv0alpha1.GCPCredentials{
															ProjectID:       "project-id",
															CredentialsFile: "/path/to/file.json",
														},
													},
												},
											},
										},
									},
								},
								"a hashicorp keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"spec": &secretv0alpha1.KeeperSpec{
													Description: "Hashicorp XYZ Keeper",
													HashiCorp: &secretv0alpha1.HashiCorpKeeperConfig{
														HashiCorpCredentials: secretv0alpha1.HashiCorpCredentials{
															Address: "vault-address",
															Token: secretv0alpha1.CredentialValue{
																ValueFromEnv: "VAULT_TOKEN",
															},
														},
													},
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
								"a sql keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v0alpha1
kind: Keeper
metadata:
  annotations:
    xx: XXX
    yy: YYY
  labels:
    aa: AAA
    bb: BBB
spec:
  description: SQL XYZ Keeper
  sql:
    encryption:
      envelope:`,
									},
								},
								"an aws keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v0alpha1
kind: Keeper
metadata:
  annotations:
    xx: XXX
  labels:
    aa: AAA
spec:
  description: AWS XYZ Keeper
  aws:
    accessKeyId: 
      valueFromEnv: ACCESS_KEY_ID_XYZ
    secretAccessKey:
      valueFromEnv: SECRET_ACCESS_KEY_XYZ
    kmsKeyId: kmsKeyId-xyz`,
									},
								},
								"an azure keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v0alpha1
kind: Keeper
metadata:
  annotations:
    xx: XXX
  labels:
    aa: AAA
spec:
  description: Azure XYZ Keeper
  azurekeyvault:
    clientSecret:
      valueFromConfig: "/path/to/file.json"
    keyVaultName: key-vault-name
    tenantId: tenant-id
    clientId: client-id`,
									},
								},
								"a gcp keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v0alpha1
kind: Keeper
metadata:
  annotations:
    xx: XXX
  labels:
    aa: AAA
spec:
  description: GCP XYZ Keeper
  gcp:
    projectId: project-id 
    credentialsFile: /path/to/file.json`,
									},
								},
								"a hashicorp keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v0alpha1
kind: Keeper
metadata:
  annotations:
    xx: XXX
  labels:
    aa: AAA
spec:
  description: Hashicorp XYZ Keeper
  hashivault:
    address: vault-address
    token:
      valueFromEnv: VAULT_TOKEN`,
									},
								},
							},
						},
					},
				},
			},
		}
	}

	exampleRef := "my-secret-in-aws"
	exampleKeeperAWS := "{aws-keeper-that-must-already-exist}"

	sub = oas.Paths.Paths[smprefix+"/securevalues"]
	if sub != nil {
		optionsSchema := defs[defsBase+"SecureValueSpec"].Schema
		sub.Post.Description = "create a secure value"
		sub.Post.RequestBody = &spec3.RequestBody{
			RequestBodyProps: spec3.RequestBodyProps{
				Content: map[string]*spec3.MediaType{
					"application/json": {
						MediaTypeProps: spec3.MediaTypeProps{
							Schema: &optionsSchema,
							Examples: map[string]*spec3.Example{
								"secret to store in default keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"spec": &secretv0alpha1.SecureValueSpec{
													Description: "A secret in default",
													Value:       "this is super duper secure",
													Decrypters:  []string{"actor_k6, actor_synthetic-monitoring"},
												},
											},
										},
									},
								},
								"secret to store in aws": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"spec": &secretv0alpha1.SecureValueSpec{
													Description: "A secret in aws",
													Value:       "this is super duper secure",
													Keeper:      &exampleKeeperAWS,
													Decrypters:  []string{"actor_k6, actor_synthetic-monitoring"},
												},
											},
										},
									},
								},
								"secret to reference in aws": {
									ExampleProps: spec3.ExampleProps{
										Value: &unstructured.Unstructured{
											Object: map[string]interface{}{
												"spec": &secretv0alpha1.SecureValueSpec{
													Description: "A secret from aws",
													Ref:         &exampleRef,
													Keeper:      &exampleKeeperAWS,
													Decrypters:  []string{"actor_k6"},
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
												"spec": &secretv0alpha1.SecureValueSpec{
													Description: "XYZ secret",
													Value:       "this is super duper secure",
													Decrypters:  []string{"actor_k6, actor_synthetic-monitoring"},
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
										Value: `apiVersion: secret.grafana.app/v0alpha1
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
    - actor_k6 
    - actor_synthetic-monitoring`,
									},
								},
								"secret to store in aws keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v0alpha1
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
  keeper: aws-keeper-that-must-already-exist
  value: this is super duper secure
  decrypters:
    - actor_k6 
    - actor_synthetic-monitoring`,
									},
								},
								"secret to reference in aws keeper": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v0alpha1
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
  keeper: aws-keeper-that-must-already-exist
  ref: my-secret-in-aws
  decrypters:
    - actor_k6`,
									},
								},
								"secret with name specified": {
									ExampleProps: spec3.ExampleProps{
										Value: `apiVersion: secret.grafana.app/v0alpha1
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
    - actor_k6 
    - actor_synthetic-monitoring`,
									},
								},
							},
						},
					},
				},
			},
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
	return authsvc.NewResourceAuthorizer(b.accessClient)
}

// Validate is called in `Create`, `Update` and `Delete` REST funcs, if the body calls the argument `rest.ValidateObjectFunc`.
func (b *SecretAPIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
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
	case *secretv0alpha1.SecureValue:
		var oldObj *secretv0alpha1.SecureValue

		if a.GetOldObject() != nil {
			var ok bool

			oldObj, ok = a.GetOldObject().(*secretv0alpha1.SecureValue)
			if !ok {
				return apierrors.NewBadRequest(fmt.Sprintf("old object is not a SecureValue, found %T", a.GetOldObject()))
			}
		}

		if errs := reststorage.ValidateSecureValue(typedObj, oldObj, operation, b.decryptersAllowList); len(errs) > 0 {
			return apierrors.NewInvalid(groupKind, a.GetName(), errs)
		}

		return nil
	case *secretv0alpha1.Keeper:
		if errs := reststorage.ValidateKeeper(typedObj, operation); len(errs) > 0 {
			return apierrors.NewInvalid(groupKind, a.GetName(), errs)
		}

		return nil
	}

	return apierrors.NewBadRequest(fmt.Sprintf("unknown spec %T", obj))
}

func (b *SecretAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	operation := a.GetOperation()

	if obj == nil || operation == admission.Connect {
		return nil // This is normal for sub-resource
	}

	// When creating a resource and the name is empty, we need to generate one.
	if operation == admission.Create && a.GetName() == "" {
		generatedName, err := util.GetRandomString(8)
		if err != nil {
			return fmt.Errorf("generate random string: %w", err)
		}

		switch typedObj := obj.(type) {
		case *secretv0alpha1.SecureValue:
			optionalPrefix := typedObj.GenerateName
			if optionalPrefix == "" {
				optionalPrefix = "sv-"
			}

			typedObj.Name = optionalPrefix + generatedName

		case *secretv0alpha1.Keeper:
			optionalPrefix := typedObj.GenerateName
			if optionalPrefix == "" {
				optionalPrefix = "kp-"
			}

			typedObj.Name = optionalPrefix + generatedName
		}
	}

	// On any mutation to a `SecureValue`, override the `phase` as `Pending` and an empty `message`.
	if operation == admission.Create || operation == admission.Update {
		sv, ok := obj.(*secretv0alpha1.SecureValue)
		if ok && sv != nil {
			sv.Status.Phase = secretv0alpha1.SecureValuePhasePending
			sv.Status.Message = ""
		}
	}

	return nil
}

func (b *SecretAPIBuilder) GetPostStartHooks() (map[string]genericapiserver.PostStartHookFunc, error) {
	return map[string]genericapiserver.PostStartHookFunc{
		"start-outbox-queue-worker": func(hookCtx genericapiserver.PostStartHookContext) error {
			if err := b.worker.ControlLoop(hookCtx.Context); err != nil {
				if !errors.Is(err, context.Canceled) {
					logging.FromContext(hookCtx).Error("secrets outbox worker exited control loop with error, secrets won't be created/updated/deleted/etc while the worker is not running: %+v", err)
					return err
				}
			}

			return nil
		},
	}, nil
}
