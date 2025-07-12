package v0alpha1

import (
	"errors"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
	utils.TableColumns{ // Returned by `kubectl get`. Doesn't affect disk storage.
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
			{Name: "Title", Type: "string"},
			{Name: "Type", Type: "string"},
			{Name: "Target", Type: "string"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*Repository)
			if !ok {
				return nil, errors.New("expected Repository")
			}

			var target string
			switch m.Spec.Type {
			case LocalRepositoryType:
				target = m.Spec.Local.Path
			case GitHubRepositoryType:
				target = m.Spec.GitHub.URL
			case GitRepositoryType:
				target = m.Spec.Git.URL
			case BitbucketRepositoryType:
				target = m.Spec.Bitbucket.URL
			case GitLabRepositoryType:
				target = m.Spec.GitLab.URL
			}

			return []interface{}{
				m.Name, // may our may not be nice to read
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				m.Spec.Title, // explicitly configured title that can change
				m.Spec.Type,
				target,
			}, nil
		},
	})

var JobResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"jobs", "job", "Job",
	func() runtime.Object { return &Job{} },     // newObj
	func() runtime.Object { return &JobList{} }, // newList
	utils.TableColumns{ // Returned by `kubectl get`. Doesn't affect disk storage.
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
			{Name: "Action", Type: "string"},
			{Name: "State", Type: "string"},
			{Name: "Message", Type: "string"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*Job)
			if !ok {
				return nil, errors.New("expected Job")
			}

			return []interface{}{
				m.Name, // may our may not be nice to read
				m.CreationTimestamp.UTC().Format(time.RFC3339),
				m.Spec.Action,
				m.Status.State,
				m.Status.Message,
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
		err := AddKnownTypes(SchemeGroupVersion, s)
		if err != nil {
			return err
		}
		metav1.AddToGroupVersion(s, SchemeGroupVersion)
		return nil
	})
}

// Adds the list of known types to the given scheme.
func AddKnownTypes(gv schema.GroupVersion, scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(gv,
		&Repository{},
		&RepositoryList{},
		&WebhookResponse{},
		&ResourceWrapper{},
		&FileList{},
		&HistoryList{},
		&TestResults{},
		&ResourceList{},
		&ResourceStats{},
		&Job{},
		&JobList{},
		&RefList{},
	)
	return nil
}

// Resource takes an unqualified resource and returns a Group qualified GroupResource
func Resource(resource string) schema.GroupResource {
	return SchemeGroupVersion.WithResource(resource).GroupResource()
}
