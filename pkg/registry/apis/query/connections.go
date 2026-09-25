package query

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/open-feature/go-sdk/openfeature"

	queryV1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func (b *QueryAPIBuilder) GetConnections(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Ds-Querier", b.instanceProvider.GetMode())

	namespace := mux.Vars(r)["namespace"]

	if namespace == "" {
		http.Error(w, "missing namespace", http.StatusNotFound)
		return
	}

	ctx := r.Context()

	if !isConnectionsEnabled(ctx, namespace) {
		http.Error(w, "connections disabled", http.StatusNotImplemented)
		return
	}

	query := r.URL.Query()
	list, err := b.connections.ListConnections(ctx, queryV1.DataSourceConnectionQuery{
		Namespace: namespace,
		Name:      query.Get("name"),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ") // pretty print
	if err := encoder.Encode(list); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

}

func isConnectionsEnabled(ctx context.Context, namespace string) bool {
	namespaceAwareEvalCtx := openfeature.NewEvaluationContext(namespace, map[string]any{
		"namespace": namespace,
	})

	ctx = openfeature.MergeTransactionContext(ctx, namespaceAwareEvalCtx)

	openfeatureClient := openfeature.NewDefaultClient()

	return openfeatureClient.Boolean(ctx, featuremgmt.FlagQueryServiceWithConnections, false, openfeature.TransactionContext(ctx))
}
