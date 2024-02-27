package ssosettingsimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ssosettings/models"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingstests"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestService_getUsageStats(t *testing.T) {
	fakeStore := &ssosettingstests.FakeStore{
		ExpectedSSOSettings: []*models.SSOSettings{
			{
				Provider: "google",
				Source:   models.DB,
			},
			{
				Provider: "github",
				Source:   models.System,
			},
			{
				Provider: "grafana_com",
				Source:   models.System,
			},
			{
				Provider: "generic_oauth",
				Source:   models.DB,
			},
			{
				Provider: "okta",
				Source:   models.DB,
			},
			{
				Provider: "azuread",
				Source:   models.DB,
			},
			{
				Provider: "gitlab",
				Source:   models.DB,
			},
		},
	}
	svc := &Service{
		logger: log.New("test"),
		store:  fakeStore,
		cfg:    &setting.Cfg{},
	}

	actual, err := svc.getUsageStats(context.Background())
	require.NoError(t, err)

	expected := map[string]any{
		"stats.sso.configured_in_db.count":              5,
		"stats.sso.azuread.config.database.count":       1,
		"stats.sso.gitlab.config.database.count":        1,
		"stats.sso.google.config.database.count":        1,
		"stats.sso.okta.config.database.count":          1,
		"stats.sso.generic_oauth.config.database.count": 1,
		"stats.sso.grafana_com.config.database.count":   0,
		"stats.sso.github.config.database.count":        0,
	}

	require.EqualValues(t, expected, actual)
}
