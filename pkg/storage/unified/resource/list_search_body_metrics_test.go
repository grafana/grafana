package resource

import (
	"errors"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Search-backed lists report body reads under the same metrics and labels as
// store lists. An exact read counts one body request per row, however many
// candidate keys it tries.
func TestServerListBodyMetricsForSearchBackedLists(t *testing.T) {
	for _, tc := range []struct {
		name           string
		maxPageBytes   int
		limit          int64
		denied         bool
		stale          bool
		failFrom       int
		wantRequested  int
		wantConsumed   int
		wantReturned   int
		wantUnused     int
		wantStopReason string
	}{
		{name: "exhausted", wantRequested: 60, wantConsumed: 60, wantReturned: 60, wantStopReason: listStopExhausted},
		{name: "byte limit", maxPageBytes: 1, wantRequested: readChunkSize, wantConsumed: readChunkSize, wantReturned: 1, wantUnused: readChunkSize - 1, wantStopReason: listStopByteLimit},
		{name: "count limit", limit: 1, wantRequested: readChunkSize, wantConsumed: readChunkSize, wantReturned: 1, wantUnused: readChunkSize - 1, wantStopReason: listStopCountLimit},
		{name: "denied", denied: true, wantRequested: 60, wantConsumed: 60, wantUnused: 60, wantStopReason: listStopExhausted},
		{name: "row storage no longer has", stale: true, wantRequested: 60, wantConsumed: 59, wantReturned: 59, wantUnused: 1, wantStopReason: listStopExhausted},
		{name: "failed read", failFrom: 1, wantRequested: readChunkSize, wantStopReason: listStopError},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store := setupBadgerKV(t)
			if tc.failFrom != 0 {
				store = &failDataBatchGetsKV{KV: store, failFrom: tc.failFrom, err: errors.New("body read failed")}
			}
			backend := setupTestStorageBackend(t, withKV(store))
			ctx := authlib.WithAuthInfo(t.Context(), &identity.StaticRequester{
				Type: authlib.TypeUser, UserID: 123, UserUID: "u123", Namespace: appsNamespace.Namespace,
			})
			denied := map[string]struct{}{}
			rows := make([]*resourcepb.ResourceSearchRow, 0, 60)
			var listRV int64
			for i := range 60 {
				name := fmt.Sprintf("resource-%03d", i)
				listRV = seedResource(t, backend, ctx, name, "")
				rv := listRV
				if tc.stale && i == 0 {
					deleteResource(t, backend, ctx, name, "", listRV)
					// The row points at the deletion, so storage has no live version for it.
					var err error
					rv, err = backend.latestResourceVersion(ctx)
					require.NoError(t, err)
				}
				rows = append(rows, folderSearchRow(appsKey(name), rv, "", name))
				if tc.denied {
					denied[name] = struct{}{}
				}
			}

			reg := prometheus.NewPedanticRegistry()
			metrics := ProvideStorageMetrics(reg)
			maxPageBytes := 1 << 20
			if tc.maxPageBytes > 0 {
				maxPageBytes = tc.maxPageBytes
			}
			s := createTestServer(&stubSearchClient{resp: folderSearchResponse(listRV, rows)}, maxPageBytes)
			s.backend = backend
			s.access = denyByNameAccess{deny: denied}
			s.storageMetrics = metrics

			rsp, err := s.List(ctx, &resourcepb.ListRequest{
				Source: resourcepb.ListRequest_STORE,
				Limit:  tc.limit,
				Options: &resourcepb.ListOptions{
					Key:    appsKey(""),
					Labels: []*resourcepb.Requirement{{Key: "team", Operator: "=", Values: []string{"a"}}},
				},
			})
			require.NoError(t, err)
			if tc.wantStopReason == listStopError {
				require.NotNil(t, rsp.Error)
			} else {
				require.Nil(t, rsp.Error)
				require.Len(t, rsp.Items, tc.wantReturned)
			}

			labels := []string{listPathSearch, tc.wantStopReason}
			require.Equal(t, float64(tc.wantRequested), testutil.ToFloat64(metrics.ListBodyKeysRequested.WithLabelValues(labels...)))
			require.Equal(t, float64(tc.wantConsumed), testutil.ToFloat64(metrics.ListBodiesConsumed.WithLabelValues(labels...)))
			require.Equal(t, float64(tc.wantReturned), testutil.ToFloat64(metrics.ListItemsReturned.WithLabelValues(labels...)))
			var metric dto.Metric
			require.NoError(t, metrics.ListUnusedBodyRequests.WithLabelValues(labels...).(prometheus.Metric).Write(&metric))
			if tc.wantStopReason == listStopError {
				require.Zero(t, metric.GetHistogram().GetSampleCount(), "failed lists must not be classified as pagination waste")
			} else {
				require.Equal(t, uint64(1), metric.GetHistogram().GetSampleCount())
				require.Equal(t, float64(tc.wantUnused), metric.GetHistogram().GetSampleSum())
			}
			_, err = reg.Gather()
			require.NoError(t, err)
		})
	}
}
