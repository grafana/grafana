package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type submissionSubresource struct {
	repoGetter RepoGetter
	logger     *slog.Logger
}

func (h *submissionSubresource) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.SubmissionList{}
}

func (h *submissionSubresource) Destroy() {}

func (h *submissionSubresource) NamespaceScoped() bool {
	return true
}

func (h *submissionSubresource) GetSingularName() string {
	return "submission"
}

func (h *submissionSubresource) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (h *submissionSubresource) ProducesObject(verb string) runtime.Object {
	return &provisioning.SubmissionList{}
}

func (h *submissionSubresource) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (h *submissionSubresource) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, "" // true adds the {path} component
}

func (h *submissionSubresource) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := h.logger.With("repository_name", name)
	repo, err := h.repoGetter.GetRepository(ctx, name)
	if err != nil {
		logger.DebugContext(ctx, "failed to find repository", "error", err)
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		ref := query.Get("ref")
		logger = logger.With("ref", ref)
		ctx := r.Context()

		var filePath string
		prefix := fmt.Sprintf("/%s/submission/", name)
		idx := strings.Index(r.URL.Path, prefix)
		if idx != -1 {
			filePath = r.URL.Path[idx+len(prefix):]
		}

		logger = logger.With("path", filePath)

		commits, err := repo.Submissions(ctx, logger, filePath, ref)
		if err != nil {
			logger.DebugContext(ctx, "failed to get submission", "error", err)
			responder.Error(err)
			return
		}

		responder.Object(http.StatusOK, &provisioning.SubmissionList{Items: commits})
	}), nil
}
