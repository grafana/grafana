package marketplacelicensing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

// TestOSSEnvironment verifies the OSS marketplace licensing environment.
func TestOSSEnvironment(t *testing.T) {
	const appURL = "https://grafana.example.com/raw"

	environment := Provide(&setting.Cfg{AppURL: appURL})

	require.Equal(t, appURL, environment.AppURL())
	token, err := environment.LicenseToken(context.Background(), "acme-widget")
	require.NoError(t, err)
	require.Empty(t, token)
}
