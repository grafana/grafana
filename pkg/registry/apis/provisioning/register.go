package provisioning

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/errors"
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

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ builder.APIGroupBuilder = (*ProvisioningAPIBuilder)(nil)

// This is used just so wire has something unique to return
type ProvisioningAPIBuilder struct{}

func NewProvisioningAPIBuilder() *ProvisioningAPIBuilder {
	return &ProvisioningAPIBuilder{}
}

func RegisterAPIService(
	features featuremgmt.FeatureToggles,
	apiregistration builder.APIRegistrar,
	reg prometheus.Registerer,
) *ProvisioningAPIBuilder {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) {
		return nil // skip registration unless opting into experimental apis
	}
	builder := NewProvisioningAPIBuilder()
	apiregistration.RegisterAPI(builder)
	return builder
}

func (b *ProvisioningAPIBuilder) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(
		func(ctx context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
			if a.GetSubresource() == "webhook" {
				// for now????
				return authorizer.DecisionAllow, "", nil
			}

			// fallback to the standard authorizer
			return authorizer.DecisionNoOpinion, "", nil
		})
}

func (b *ProvisioningAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return provisioning.SchemeGroupVersion
}

func (b *ProvisioningAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	err := provisioning.AddToScheme(scheme)
	if err != nil {
		return err
	}

	// This is required for --server-side apply
	err = provisioning.AddKnownTypes(provisioning.InternalGroupVersion, scheme)
	if err != nil {
		return err
	}

	// Only 1 version (for now?)
	return scheme.SetVersionPriority(provisioning.SchemeGroupVersion)
}

func (b *ProvisioningAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	repositoryStorage, err := grafanaregistry.NewRegistryStore(opts.Scheme, provisioning.RepositoryResourceInfo, opts.OptsGetter)
	if err != nil {
		return fmt.Errorf("failed to create repository storage: %w", err)
	}
	repositoryStatusStorage := grafanaregistry.NewRegistryStatusStore(opts.Scheme, repositoryStorage)

	helloWorld := &helloWorldSubresource{
		getter:        repositoryStorage,
		statusUpdater: repositoryStatusStorage,
	}

	storage := map[string]rest.Storage{}
	storage[provisioning.RepositoryResourceInfo.StoragePath()] = repositoryStorage
	// Can be used by kubectl: kubectl --kubeconfig grafana.kubeconfig patch Repository local-devenv --type=merge --subresource=status --patch='status: {"currentGitCommit": "hello"}'
	storage[provisioning.RepositoryResourceInfo.StoragePath("status")] = repositoryStatusStorage
	storage[provisioning.RepositoryResourceInfo.StoragePath("hello")] = helloWorld
	storage[provisioning.RepositoryResourceInfo.StoragePath("webhook")] = &webhookConnector{
		getter: repositoryStorage,
	}
	storage[provisioning.RepositoryResourceInfo.StoragePath("read")] = &readConnector{
		getter: repositoryStorage,
	}
	apiGroupInfo.VersionedResourcesStorageMap[provisioning.VERSION] = storage
	return nil
}

func (b *ProvisioningAPIBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	obj := a.GetObject()
	if obj == nil {
		return fmt.Errorf("missing object for validation")
	}
	r, ok := obj.(*provisioning.Repository)
	if !ok {
		return fmt.Errorf("expected repository configuration")
	}

	var list field.ErrorList
	if r.Spec.Title == "" {
		list = append(list, field.Required(field.NewPath("spec", "title"), "a repository title must be given"))
	}

	// Reserved names (for now)
	reserved := []string{"classic", "SQL", "plugins", "legacy"}
	if slices.Contains(reserved, r.Name) {
		list = append(list, field.Invalid(field.NewPath("metadata", "name"), r.Name, "Name is reserved"))
	}

	switch r.Spec.Type {
	case provisioning.LocalRepositoryType:
		if r.Spec.Local == nil || r.Spec.Local.Path == "" {
			list = append(list, field.Required(field.NewPath("spec", "local", "path"), "a path to a local file system is required"))
		} else {
			// TODO... configure an allow list of paths we can read
			if !strings.HasPrefix(r.Spec.Local.Path, "/tmp/") {
				list = append(list, field.Invalid(field.NewPath("spec", "local", "path"), r.Spec.Local.Path,
					"invalid local file for provisioning"))
			}
		}
	case provisioning.S3RepositoryType:
		s3 := r.Spec.S3
		if s3 == nil {
			list = append(list, field.Required(field.NewPath("spec", "s3"), "an s3 config is required"))
			break
		}
		if s3.Region == "" {
			list = append(list, field.Required(field.NewPath("spec", "s3", "region"), "an s3 region is required"))
		}
		if s3.Bucket == "" {
			list = append(list, field.Required(field.NewPath("spec", "s3", "bucket"), "an s3 bucket name is required"))
		}
	case provisioning.GithubRepositoryType:
		gh := r.Spec.GitHub
		if gh == nil {
			list = append(list, field.Required(field.NewPath("spec", "github"), "a github config is required"))
			break
		}
		if gh.Owner == "" {
			list = append(list, field.Required(field.NewPath("spec", "github", "owner"), "a github repo owner is required"))
		}
		if gh.Repository == "" {
			list = append(list, field.Required(field.NewPath("spec", "github", "repository"), "a github repo name is required"))
		}
		if gh.Token == "" {
			list = append(list, field.Required(field.NewPath("spec", "github", "token"), "a github access token is required"))
		}
		if gh.GenerateDashboardPreviews && !gh.BranchWorkflow {
			list = append(list, field.Forbidden(field.NewPath("spec", "github", "token"), "to generate dashboard previews, you must activate the branch workflow"))
		}
	default:
		list = append(list, field.TypeInvalid(field.NewPath("spec", "type"), r.Spec.Type, "the repository type must be one of local, s3, or github"))
	}

	if len(list) > 0 {
		return errors.NewInvalid(schema.GroupKind{
			Group: provisioning.GROUP,
			Kind:  "Repository", //??
		}, a.GetName(), list)
	}
	return nil

}

func (b *ProvisioningAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return provisioning.GetOpenAPIDefinitions
}

func (b *ProvisioningAPIBuilder) GetAPIRoutes() *builder.APIRoutes {
	// TODO: this is where we could inject a non-k8s managed handler... webhook maybe?
	return nil
}

func (b *ProvisioningAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	oas.Info.Description = "Provisioning"

	root := "/apis/" + b.GetGroupVersion().String() + "/"
	repoprefix := root + "namespaces/{namespace}/repositories/{name}"

	// TODO: we might want to register some extras for subresources here.
	sub := oas.Paths.Paths[repoprefix+"/hello"]
	if sub != nil && sub.Get != nil {
		sub.Get.Description = "Get a nice hello :)"
		sub.Get.Parameters = []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "whom",
					In:          "query",
					Example:     "World!",
					Description: "Who should get the nice greeting?",
					Schema:      spec.StringProperty(),
					Required:    false,
				},
			},
		}
	}

	sub = oas.Paths.Paths[repoprefix+"/webhook"]
	if sub != nil && sub.Get != nil {
		sub.Post.Description = "Currently only supports github webhooks"
	}

	// hide the version with no path
	delete(oas.Paths.Paths, repoprefix+"/read")

	// update the version with a path
	sub = oas.Paths.Paths[repoprefix+"/read/{path}"]
	if sub != nil && sub.Get != nil {
		sub.Get.Description = "Read value from upstream repository"
		sub.Get.Parameters = []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "commit",
					In:          "query",
					Example:     "ca171cc730",
					Description: "optional commit hash for the requested file",
					Schema:      spec.StringProperty(),
					Required:    false,
				},
			},
		}
	}

	// The root API discovery list
	sub = oas.Paths.Paths[root]
	if sub != nil && sub.Get != nil {
		sub.Get.Tags = []string{"API Discovery"} // sorts first in the list
	}

	return oas, nil
}
