package provisioning

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta2"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apiutils "github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/auditing"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

var (
	_ builder.APIGroupBuilder          = (*v1beta2APIBuilder)(nil)
	_ builder.APIGroupVersionProvider  = (*v1beta2APIBuilder)(nil)
	_ builder.APIGroupAuthorizer       = (*v1beta2APIBuilder)(nil)
	_ builder.APIGroupAuditor          = (*v1beta2APIBuilder)(nil)
	_ builder.APIGroupMutation         = (*v1beta2APIBuilder)(nil)
	_ builder.APIGroupValidation       = (*v1beta2APIBuilder)(nil)
	_ builder.APIGroupResourceProvider = (*v1beta2APIBuilder)(nil)
	_ builder.OpenAPIPostProcessor     = (*v1beta2APIBuilder)(nil)
)

// v1beta2APIBuilder serves the v1beta2 kinds. Objects are stored, admitted and reconciled as
// v1beta2StorageVersion: the stores convert through v1beta2StorageSerializer, and admission and
// authorization delegate to the v0alpha1 builder. Enterprise extras don't apply to v1beta2 yet.
type v1beta2APIBuilder struct {
	inner     *APIBuilder
	admission *v1beta2Admission
}

func newV1beta2APIBuilder(inner *APIBuilder) *v1beta2APIBuilder {
	return &v1beta2APIBuilder{inner: inner}
}

func (b *v1beta2APIBuilder) GetGroupVersion() schema.GroupVersion {
	return v1beta2.GroupVersion
}

func (b *v1beta2APIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	b.admission = &v1beta2Admission{scheme: scheme, inner: b.inner}
	if err := v1beta2.AddToScheme(scheme); err != nil {
		return err
	}
	if err := v1beta2.RegisterConversions(scheme); err != nil {
		return err
	}
	return scheme.AddFieldLabelConversionFunc(
		v1beta2.RepositoryResourceInfo.GroupVersionKind(),
		func(label, value string) (string, string, error) {
			switch label {
			case "metadata.name", "metadata.namespace", "spec.connection.name":
				return label, value, nil
			default:
				return "", "", fmt.Errorf("field label not supported for Repository: %s", label)
			}
		},
	)
}

// AllowedV0Alpha1Resources is asked of every builder in the group, about the group's v0alpha1
// resources, so it must not hide what the v0alpha1 builder serves.
func (b *v1beta2APIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

func (b *v1beta2APIBuilder) usesUnifiedJobHistory() bool {
	return b.inner.jobHistoryConfig == nil || b.inner.jobHistoryConfig.Loki == nil
}

// GetResourceInfos mirrors the v0alpha1 builder: with Loki, historic jobs are only read through
// the jobs subresource.
func (b *v1beta2APIBuilder) GetResourceInfos(schema.GroupVersion) []apiutils.ResourceInfo {
	infos := []apiutils.ResourceInfo{
		v1beta2.RepositoryResourceInfo,
		v1beta2.ConnectionResourceInfo,
		v1beta2.JobResourceInfo,
	}
	if b.usesUnifiedJobHistory() {
		infos = append(infos, v1beta2.HistoricJobResourceInfo)
	}
	return infos
}

func (b *v1beta2APIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	// Without storage options the codec would persist v1beta2 JSON, which older versions can't read.
	if _, ok := opts.OptsGetter.(apistore.StorageOptionsGetter); !ok {
		return fmt.Errorf("serving %s requires unified storage, got %T", v1beta2.GroupVersion, opts.OptsGetter)
	}
	serializer := &v1beta2StorageSerializer{scheme: opts.Scheme}
	optsGetter := func(info apiutils.ResourceInfo) generic.RESTOptionsGetter {
		return opts.StorageOptsGetterFor(info, apistore.StorageOptions{Serializer: serializer})
	}

	repositoryStore, err := grafanaregistry.NewRegistryStoreWithSelectableFields(
		opts.Scheme,
		v1beta2.RepositoryResourceInfo,
		optsGetter(v1beta2.RepositoryResourceInfo),
		grafanaregistry.SelectableFieldsOptions{GetAttrs: v1beta2RepositoryGetAttrs},
	)
	if err != nil {
		return fmt.Errorf("create repository storage: %w", err)
	}
	connectionStore, err := grafanaregistry.NewRegistryStore(opts.Scheme, v1beta2.ConnectionResourceInfo, optsGetter(v1beta2.ConnectionResourceInfo))
	if err != nil {
		return fmt.Errorf("create connection storage: %w", err)
	}
	jobStore, err := grafanaregistry.NewCompleteRegistryStore(opts.Scheme, v1beta2.JobResourceInfo, optsGetter(v1beta2.JobResourceInfo))
	if err != nil {
		return fmt.Errorf("create job storage: %w", err)
	}

	storage := map[string]rest.Storage{
		v1beta2.RepositoryResourceInfo.StoragePath():         repositoryStore,
		v1beta2.RepositoryResourceInfo.StoragePath("status"): grafanaregistry.NewRegistryStatusStore(opts.Scheme, repositoryStore),
		v1beta2.ConnectionResourceInfo.StoragePath():         connectionStore,
		v1beta2.ConnectionResourceInfo.StoragePath("status"): grafanaregistry.NewRegistryStatusStore(opts.Scheme, connectionStore),
		v1beta2.JobResourceInfo.StoragePath():                jobStore,
	}
	if b.usesUnifiedJobHistory() {
		historicJobStore, err := grafanaregistry.NewCompleteRegistryStore(opts.Scheme, v1beta2.HistoricJobResourceInfo, optsGetter(v1beta2.HistoricJobResourceInfo))
		if err != nil {
			return fmt.Errorf("create historic job storage: %w", err)
		}
		storage[v1beta2.HistoricJobResourceInfo.StoragePath()] = &historicJobStorage{Store: historicJobStore}
	}

	apiGroupInfo.VersionedResourcesStorageMap[v1beta2.APIVersion] = storage
	return nil
}

func v1beta2RepositoryGetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	repo, ok := obj.(*v1beta2.Repository)
	if !ok {
		return nil, nil, fmt.Errorf("given object is not a Repository")
	}
	var connection string
	if repo.Spec.Connection != nil {
		connection = repo.Spec.Connection.Name
	}
	return labels.Set(repo.Labels), generic.MergeFieldsSets(
		generic.ObjectMetaFieldsSet(&repo.ObjectMeta, true),
		fields.Set{"spec.connection.name": connection},
	), nil
}

// GetAuthorizer authorizes the same resources, subresources and verbs as v0alpha1, without the
// enterprise extras.
func (b *v1beta2APIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
		if identity.IsServiceIdentity(ctx) {
			return authorizer.DecisionAllow, "", nil
		}
		return b.inner.authorizeResource(ctx, a)
	})
}

func (b *v1beta2APIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	return b.admission.Mutate(ctx, a, o)
}

func (b *v1beta2APIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	return b.admission.Validate(ctx, a, o)
}

func (b *v1beta2APIBuilder) GetPolicyRuleEvaluator() auditing.PolicyRuleEvaluator {
	return b.inner.GetPolicyRuleEvaluator()
}

func (b *v1beta2APIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return v1beta2.GetOpenAPIDefinitions
}

func (b *v1beta2APIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Provisioning"
	hideHistoricJobPaths(oas.Paths.Paths, "/apis/"+v1beta2.GroupVersion.String()+"/")
	return oas, nil
}
