package interceptors

import (
	"context"
	"strings"
	"sync"
	"testing"
	"testing/synctest"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
)

func TestConcurrencyInterceptors(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		reg := prometheus.NewPedanticRegistry()
		metrics := NewConcurrencyMetrics(reg)
		unary := UnaryConcurrencyInterceptor(metrics)
		stream := StreamConcurrencyInterceptor(metrics)

		release := make(chan struct{})
		var wg sync.WaitGroup
		for range 3 {
			wg.Go(func() {
				_, err := unary(t.Context(), nil, &grpc.UnaryServerInfo{FullMethod: "/svc/Read"}, func(context.Context, any) (any, error) {
					<-release
					return nil, nil
				})
				assert.NoError(t, err)
			})
		}
		wg.Go(func() {
			err := stream(nil, nil, &grpc.StreamServerInfo{FullMethod: "/svc/List"}, func(any, grpc.ServerStream) error {
				<-release
				return nil
			})
			assert.NoError(t, err)
		})
		synctest.Wait()

		close(release)
		wg.Wait()

		// Finished requests must no longer count toward later arrivals.
		_, err := unary(t.Context(), nil, &grpc.UnaryServerInfo{FullMethod: "/svc/Read"}, func(context.Context, any) (any, error) {
			return nil, nil
		})
		require.NoError(t, err)

		require.NoError(t, testutil.GatherAndCompare(reg, strings.NewReader(`
# HELP grafana_grpc_requests_in_flight_at_arrival gRPC requests of the same route already being handled when a request arrives, including requests later rejected by authentication.
# TYPE grafana_grpc_requests_in_flight_at_arrival histogram
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="0"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="1"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="2"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="5"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="10"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="20"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="50"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="100"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="200"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="500"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="1000"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/List",le="+Inf"} 1
grafana_grpc_requests_in_flight_at_arrival_sum{route="/svc/List"} 0
grafana_grpc_requests_in_flight_at_arrival_count{route="/svc/List"} 1
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="0"} 2
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="1"} 3
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="2"} 4
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="5"} 4
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="10"} 4
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="20"} 4
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="50"} 4
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="100"} 4
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="200"} 4
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="500"} 4
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="1000"} 4
grafana_grpc_requests_in_flight_at_arrival_bucket{route="/svc/Read",le="+Inf"} 4
grafana_grpc_requests_in_flight_at_arrival_sum{route="/svc/Read"} 3
grafana_grpc_requests_in_flight_at_arrival_count{route="/svc/Read"} 4
`)))
	})
}
