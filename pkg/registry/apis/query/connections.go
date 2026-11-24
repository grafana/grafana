package query

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	queryV1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

const maxConnectionsLimit = 5000

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
	if b.lister == nil {
		http.Error(w, "connections not available", http.StatusNotImplemented)
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

	user, err := identity.GetRequester(ctx)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	ns, err := claims.ParseNamespace(namespace)
	if err != nil || ns.OrgID == 0 {
		http.Error(w, "invalid namespace", http.StatusBadRequest)
		return
	}
	if ns.OrgID != user.GetOrgID() { // We may allow services to access other orgs in the future
		http.Error(w, "user must be in the requested namespace", http.StatusForbidden)
		return
	}

	list := queryV1.DataSourceConnectionList{
		TypeMeta: metav1.TypeMeta{
			APIVersion: queryV1.SchemeGroupVersion.String(),
			Kind:       "DataSourceConnectionList",
		},
		Items: []queryV1.DataSourceConnection{},
	}
	if name := query.Get("name"); name != "" {
		item, err := b.lister.lookup(ctx, user, ns.OrgID, name)
		if err != nil && !apierrors.IsNotFound(err) {
			writeConnectionsError(w, err)
			return
		}
		if item != nil {
			list.Items = append(list.Items, asConnection(*item))
		}
	} else {
		page, err := b.lister.list(ctx, user, ns.OrgID, listQuery{limit: limit, cursor: query.Get("continue")})
		if err != nil {
			writeConnectionsError(w, err)
			return
		}
		for _, item := range page.items {
			list.Items = append(list.Items, asConnection(item))
		}
		list.Continue = page.cursor
	}

	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ") // pretty print
	if err := encoder.Encode(list); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

// asConnection is the connections projection of a listed datasource. The group label is left
// out: the group it names is the connection's group.
func asConnection(d listedDataSource) queryV1.DataSourceConnection {
	var labels map[string]string
	for k, v := range d.meta.Labels {
		if k == queryV1.LabelKeyGroup {
			continue
		}
		if labels == nil {
			labels = map[string]string{}
		}
		labels[k] = v
	}
	return queryV1.DataSourceConnection{
		Title:    d.title,
		Name:     d.meta.Name,
		APIGroup: d.group(),
		Plugin:   d.plugin,
		Labels:   labels,
	}
}

func writeConnectionsError(w http.ResponseWriter, err error) {
	code := http.StatusInternalServerError
	var status apierrors.APIStatus
	if errors.As(err, &status) && status.Status().Code > 0 {
		code = int(status.Status().Code)
	}
	http.Error(w, err.Error(), code)
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
