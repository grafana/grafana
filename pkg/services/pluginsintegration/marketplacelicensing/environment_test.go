package marketplacelicensing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestOSSEnvironment(t *testing.T) {
	const appURL = "https://grafana.example.com/raw"

	environment := ProvideEnvironment(&setting.Cfg{AppURL: appURL})

	require.Equal(t, appURL, environment.AppURL())
	require.NoError(t, environment.Prepare(context.Background(), "acme-widget"))
}
