package cloudmonitoring

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/tsdb/cloud-monitoring/kinds/dataquery"
	"github.com/stretchr/testify/require"
)

func TestPromqlQuery(t *testing.T) {
	t.Run("parseResponse is returned", func(t *testing.T) {
		service := &Service{}
		fileData, err := os.ReadFile("./test-data/11-prom-response.json")
		reader := strings.NewReader(string(fileData))
		res := http.Response{Body: io.NopCloser(reader)}
		if err != nil {
			t.Fatal(err)
		}
		require.NoError(t, err)
		dataRes := &backend.DataResponse{}
		query := &cloudMonitoringProm{}
		parsedProm := parseProm(&res)
		err = query.parseResponse(dataRes, parsedProm, "", service.logger)
		require.NoError(t, err)
		frame := dataRes.Frames[0]
		experimental.CheckGoldenJSONFrame(t, "test-data", "parse-response-is-returned", frame, false)
	})

	t.Run("parseResponse is returned with error", func(t *testing.T) {
		dsInfo := datasourceInfo{
			authenticationType: gceAuthentication,
		}

		im := datasource.NewInstanceManager(func(_ context.Context, s backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
			return &dsInfo, nil
		})

		service := &Service{
			im: im,
			gceDefaultProjectGetter: func(ctx context.Context, scope string) (string, error) {
				return "", fmt.Errorf("not found!")
			},
		}

		query := &cloudMonitoringProm{
			parameters: &dataquery.PromQLQuery{
				ProjectName: "",
			},
		}

		dr, parsedProm, _, err := query.run(context.Background(), &backend.QueryDataRequest{}, service, dsInfo, service.logger)
		require.NoError(t, err)
		require.Error(t, dr.Error)
		require.Equal(t, "not found!", dr.Error.Error())
		require.True(t, backend.IsDownstreamError(dr.Error))

		err = query.parseResponse(dr, parsedProm, "", service.logger)
		require.NoError(t, err)
	})
}
