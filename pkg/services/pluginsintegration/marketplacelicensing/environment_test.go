package marketplacelicensing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestOSSLicense(t *testing.T) {
	const appURL = "https://grafana.example.com/raw"

	marketplaceLicensing := Provide(&setting.Cfg{AppURL: appURL})

	require.Equal(t, appURL, marketplaceLicensing.AppURL())
	token, err := marketplaceLicensing.LicenseToken(context.Background(), "acme-widget")
	require.NoError(t, err)
	require.Empty(t, token)
}
