package chunked

import (
	"context"
	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// QueryTypesFlag is the datasource type allowlist shared by query service clients.
const QueryTypesFlag = "datasources.querier.chunked-types"

// UseChunkedQuery selects downstream chunking for a resolved datasource type.
func UseChunkedQuery(ctx context.Context, datasourceType string) bool {
	if info, ok := request.RequestInfoFrom(ctx); ok && info.Namespace != "" {
		ctx = openfeature.MergeTransactionContext(ctx, openfeature.NewEvaluationContext(info.Namespace, map[string]any{"namespace": info.Namespace}))
	}
	value := openfeature.NewDefaultClient().Object(ctx, QueryTypesFlag, map[string]any{"types": []any{}}, openfeature.TransactionContext(ctx))
	object, ok := value.(map[string]any)
	if !ok {
		return false
	}
	types, ok := object["types"].([]any)
	if !ok {
		return false
	}
	enabled := false
	for _, value := range types {
		dsType, ok := value.(string)
		if !ok {
			return false
		}
		enabled = enabled || dsType == datasourceType
	}
	return enabled
}
