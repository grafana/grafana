package cloudmonitoring

import (
	"io"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

func TestPromqlQuery(t *testing.T) {
	t.Run("parseResponse is returned", func(t *testing.T) {
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
		err = query.parseResponse(dataRes, parsedProm, "")
		require.NoError(t, err)
		frame := dataRes.Frames[0]
		experimental.CheckGoldenJSONFrame(t, "test-data", "parse-response-is-returned", frame, false)
	})
}
