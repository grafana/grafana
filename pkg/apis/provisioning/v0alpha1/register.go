package v0alpha1

import (
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/klog/v2"
)

const (
	GROUP      = "provisioning.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var RepositoryResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"repositories", "repository", "Repositories",
	func() runtime.Object { return &Repository{} },     // newObj
	func() runtime.Object { return &RepositoryList{} }, // newList
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
			// TODO: Add more here when I figure out the model...
			// I think this is just the table you get in `kubectl get`. It shouldn't deal with anything around storage.
			{Name: "Type", Type: "string"},
			{Name: "Target", Type: "string"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*Repository)
			if !ok {
				return nil, errors.New("expected Repository")
			}

			var typ, target string
			if !m.Spec.GitHub.IsEmpty() {
				typ = "github"
				// TODO: Enterprise GH??
				target = fmt.Sprintf("%s/%s", m.Spec.GitHub.Owner, m.Spec.GitHub.Repository)
			} else if !m.Spec.Local.IsEmpty() {
				typ = "local"
				target = m.Spec.Local.Path
			} else if !m.Spec.S3.IsEmpty() {
				typ = "s3"
				// TODO: Can bucket URLs include sensitive info?
				target = m.Spec.S3.Bucket
			} else {
				klog.InfoS("we have a repository with no known tabular converter",
					"name", m.Name, "namespace", m.Namespace)
			}

			return []interface{}{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				typ,
				target,
			}, nil
		},
	})

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion   = schema.GroupVersion{Group: GROUP, Version: VERSION}
	InternalGroupVersion = schema.GroupVersion{Group: GROUP, Version: runtime.APIVersionInternal}

	// SchemaBuilder is used by standard codegen
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

func init() {
	localSchemeBuilder.Register(func(s *runtime.Scheme) error {
		return AddKnownTypes(SchemeGroupVersion, s)
	})
}

// Adds the list of known types to the given scheme.
func AddKnownTypes(gv schema.GroupVersion, scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(gv,
		&Repository{},
		&RepositoryList{},
	)
	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
