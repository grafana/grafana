package provisioning

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"

	"golang.org/x/oauth2"

	"github.com/google/go-github/v66/github"
)

type readConnector struct {
	getter rest.Getter
}

func (*readConnector) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.ResourceWrapper{}
}

func (*readConnector) Destroy() {}

func (*readConnector) NamespaceScoped() bool {
	return true
}

func (*readConnector) GetSingularName() string {
	return "Resource"
}

func (*readConnector) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (*readConnector) ProducesObject(verb string) any {
	return &provisioning.ResourceWrapper{}
}

func (*readConnector) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (*readConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, "" // true adds the {path} component
}

func (s *readConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	obj, err := s.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	repo, ok := obj.(*provisioning.Repository)
	if !ok {
		return nil, fmt.Errorf("expected repository, but got %t", obj)
	}

	tokenSrc := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: repo.Spec.GitHub.Token},
	)
	tokenClient := oauth2.NewClient(ctx, tokenSrc)
	githubClient := github.NewClient(tokenClient)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		idx := strings.Index(r.URL.Path, "/"+name+"/read")
		filePath := strings.TrimLeft(r.URL.Path[idx+len(name+"/read")+2:], "/")
		if filePath == "" {
			// TODO: return bad request status code
			responder.Error(fmt.Errorf("missing path"))
			return
		}
		commit := r.URL.Query().Get("commit")

		owner, repoName, err := extractOwnerAndRepo(repo.Spec.GitHub.Repository)
		if err != nil {
			responder.Error(fmt.Errorf("failed to extract owner and repo: %w", err))
			return
		}

		content, _, _, err := githubClient.Repositories.GetContents(ctx, owner, repoName, filePath, &github.RepositoryContentGetOptions{
			Ref: commit,
		})
		if err != nil {
			// TODO: return bad request status code
			responder.Error(fmt.Errorf("failed to get content: %w", err))
			return
		}

		data, err := content.GetContent()
		if err != nil {
			responder.Error(err)
			return
		}

		var dashboardJSON map[string]interface{}
		if err := json.Unmarshal([]byte(data), &dashboardJSON); err != nil {
			// TODO: return bad request status code
			responder.Error(fmt.Errorf("failed to unmarshal content: %w", err))
			return
		}

		// TODO: validate the object is a valid dashboard
		// Return the wrapped response
		// Note we can not return it directly (using responder) because that will make sure the
		// top level apiVersion is provisioning, not the remote resource
		wrapper := &provisioning.ResourceWrapper{
			Commit: commit,
			Resource: common.Unstructured{
				Object: dashboardJSON,
			},
		}
		responder.Object(http.StatusOK, wrapper)
	}), nil
}

var (
	_ rest.Storage              = (*readConnector)(nil)
	_ rest.Connecter            = (*readConnector)(nil)
	_ rest.Scoper               = (*readConnector)(nil)
	_ rest.SingularNameProvider = (*readConnector)(nil)
	_ rest.StorageMetadata      = (*readConnector)(nil)
)

// TODO: add validation in admission hook
// extractOwnerAndRepo takes a GitHub repository URL and returns the owner and repo name.
func extractOwnerAndRepo(repoURL string) (string, string, error) {
	parsedURL, err := url.Parse(repoURL)
	if err != nil {
		return "", "", fmt.Errorf("invalid URL: %w", err)
	}

	// Split the path to get owner and repo
	parts := strings.Split(strings.Trim(parsedURL.Path, "/"), "/")
	if len(parts) < 2 {
		return "", "", fmt.Errorf("URL does not contain owner and repo")
	}

	owner := parts[0]
	repo := parts[1]
	return owner, repo, nil
}
