package query

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/open-feature/go-sdk/openfeature"

	queryV1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

const maxConnectionsLimit = 1000

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
	limit, err := parseConnectionsLimit(query.Get("limit"))
	if err != nil {
		http.Error(w, "invalid limit", http.StatusBadRequest)
		return
	}

	// if no limit specified, or if more than max is requested, go with max
	if (limit == 0) || (limit > maxConnectionsLimit) {
		limit = maxConnectionsLimit
	}

	offset, err := parseConnectionsContinue(query.Get("continue"))
	if err != nil {
		http.Error(w, "invalid continue token", http.StatusBadRequest)
		return
	}

	list, err := b.connections.ListConnections(ctx, queryV1.DataSourceConnectionQuery{
		Namespace: namespace,
		Name:      query.Get("name"),
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	low, high, c := getSliceInfo(int64(len(list.Items)), offset, limit)
	slicedItems := list.Items[low:high]

	// we need to keep some metadata from the original list
	// but we must not keep all metadata, there may be values there
	// that are not valid anymore, like RemainingItems

	slicedList := queryV1.DataSourceConnectionList{
		TypeMeta: list.TypeMeta,
		Items:    slicedItems,
	}

	if c {
		slicedList.Continue = fmt.Sprintf("v1_%d", high)
	}

	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ") // pretty print
	if err := encoder.Encode(slicedList); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

}

func parseConnectionsLimit(value string) (int64, error) {
	if value == "" {
		return 0, nil
	}

	limit, err := strconv.ParseInt(value, 10, 64)
	if err != nil || limit < 0 {
		return 0, errors.New("invalid limit")
	}
	return limit, nil
}

func parseConnectionsContinue(value string) (int64, error) {
	if value == "" {
		return 0, nil
	}

	// it's shape is `v1_<number>`
	if !strings.HasPrefix(value, "v1_") {
		return 0, errors.New("invalid continue value")
	}
	trimmedValue := strings.TrimPrefix(value, "v1_")

	result, err := strconv.ParseInt(trimmedValue, 10, 64)

	if (err != nil) || (result < 0) {
		return 0, errors.New("invalid continue value")
	}

	return result, nil
}

func getSliceInfo(length int64, offset int64, limit int64) (int64, int64, bool) {
	if (offset >= length) || (limit == 0) {
		// zero length slice
		return length, length, false
	}

	// we default to going "to the end"
	high := length
	if limit < length-offset {
		high = offset + limit
	}

	return offset, high, length > high
}

func isConnectionsEnabled(ctx context.Context, namespace string) bool {
	namespaceAwareEvalCtx := openfeature.NewEvaluationContext(namespace, map[string]any{
		"namespace": namespace,
	})

	ctx = openfeature.MergeTransactionContext(ctx, namespaceAwareEvalCtx)

	openfeatureClient := openfeature.NewDefaultClient()

	return openfeatureClient.Boolean(ctx, featuremgmt.FlagQueryServiceWithConnections, false, openfeature.TransactionContext(ctx))
}
