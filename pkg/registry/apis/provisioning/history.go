package provisioning

import (
	"context"
	"fmt"
	"net/http"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/safepath"
)

type historySubresource struct {
	repoGetter RepoGetter
}

func (h *historySubresource) New() runtime.Object {
	// This is added as the "ResponseType" regardless what ProducesObject() returns
	return &provisioning.HistoryList{}
}

func (h *historySubresource) Destroy() {}

func (h *historySubresource) NamespaceScoped() bool {
	return true
}

func (h *historySubresource) GetSingularName() string {
	return "History"
}

func (h *historySubresource) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (h *historySubresource) ProducesObject(verb string) runtime.Object {
	return &provisioning.HistoryList{}
}

func (h *historySubresource) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (h *historySubresource) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, "" // true adds the {path} component
}

func (h *historySubresource) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	logger := logging.FromContext(ctx).With("logger", "history-subresource")
	ctx = logging.Context(ctx, logger)
	repo, err := h.repoGetter.GetHealthyRepository(ctx, name)
	if err != nil {
		logger.Debug("failed to find repository", "error", err)
		return nil, err
	}

	return withTimeout(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		versioned, ok := repo.(repository.Versioned)
		if !ok {
			responder.Error(apierrors.NewBadRequest("this repository does not support history"))
			return
		}

		query := r.URL.Query()
		ref := query.Get("ref")

		filePath, err := pathAfterPrefix(r.URL.Path, fmt.Sprintf("/%s/history/", name))
		if err != nil {
			responder.Error(apierrors.NewBadRequest(err.Error()))
			return
		}

		if err := safepath.IsSafe(filePath); err != nil {
			responder.Error(apierrors.NewBadRequest(err.Error()))
			return
		}

		logger = logger.With("ref", ref, "path", filePath)
		ctx = logging.Context(r.Context(), logger)

		// TODO: Add history pagination
		commits, err := versioned.History(ctx, filePath, ref)
		if err != nil {
			logger.Debug("failed to get history", "error", err)
			responder.Error(err)
			return
		}

		responder.Object(http.StatusOK, &provisioning.HistoryList{Items: commits})
	}), 30*time.Second), nil
}
