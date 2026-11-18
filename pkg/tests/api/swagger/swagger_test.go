package swagger

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// The swagger routes are registered by server.New rather than by pkg/api or a
// wire provider, so this checks that a fully started server still serves them.
// It uses the /swagger-ui redirect because /swagger itself needs the frontend
// bundle, which test environments may not have built.
func TestSwaggerRoutesOnCoreServer(t *testing.T) {
	dir, cfgPath := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{})
	addr, _ := testinfra.StartGrafana(t, dir, cfgPath)

	client := &http.Client{
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}

	resp, err := client.Get("http://" + addr + "/swagger-ui")
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })

	assert.Equal(t, http.StatusMovedPermanently, resp.StatusCode)
	assert.Equal(t, "/swagger", resp.Header.Get("Location"))
}
