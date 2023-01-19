package resolver

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestResolver(t *testing.T) {
	ctxOrg1 := appcontext.WithUser(context.Background(), &user.SignedInUser{OrgID: 1})

	ds := &fakeDatasources.FakeDataSourceService{
		DataSources: []*datasources.DataSource{
			{
				Id:        123,
				OrgId:     1,
				Type:      "influx",
				Uid:       "influx-uid",
				IsDefault: true,
			},
			{
				Id:    234,
				OrgId: 1,
				Type:  "influx",
				Uid:   "influx-uid2",
				Name:  "Influx2",
			},
		},
	}

	p1 := plugins.PluginDTO{}
	p2 := plugins.PluginDTO{}
	p3 := plugins.PluginDTO{}

	p1.ID = "influx"
	p2.ID = "heatmap"
	p3.ID = "xyz"
	pluginStore := plugins.FakePluginStore{
		PluginList: []plugins.PluginDTO{p1, p2, p3},
	}
	provider := ProvideEntityReferenceResolver(ds, pluginStore)

	scenarios := []struct {
		name   string
		given  *models.EntityExternalReference
		expect ResolutionInfo
		err    string
		ctx    context.Context
	}{
		{
			name: "Missing datasource without type",
			given: &models.EntityExternalReference{
				Kind: models.StandardKindDataSource,
				UID:  "xyz",
			},
			expect: ResolutionInfo{OK: false},
			ctx:    ctxOrg1,
		},
		{
			name: "OK datasource",
			given: &models.EntityExternalReference{
				Kind: models.StandardKindDataSource,
				Type: "influx",
				UID:  "influx-uid",
			},
			expect: ResolutionInfo{OK: true, Key: "influx-uid"},
			ctx:    ctxOrg1,
		},
		{
			name: "Get the default datasource",
			given: &models.EntityExternalReference{
				Kind: models.StandardKindDataSource,
			},
			expect: ResolutionInfo{
				OK:      true,
				Key:     "influx-uid",
				Warning: "type not specified",
			},
			ctx: ctxOrg1,
		},
		{
			name: "Get the default datasource (with type)",
			given: &models.EntityExternalReference{
				Kind: models.StandardKindDataSource,
				Type: "influx",
			},
			expect: ResolutionInfo{
				OK:  true,
				Key: "influx-uid",
			},
			ctx: ctxOrg1,
		},
		{
			name: "Lookup by name",
			given: &models.EntityExternalReference{
				Kind: models.StandardKindDataSource,
				UID:  "Influx2",
			},
			expect: ResolutionInfo{
				OK:      true,
				Key:     "influx-uid2",
				Warning: "type not specified",
			},
			ctx: ctxOrg1,
		},
		{
			name:   "invalid input",
			given:  nil,
			expect: ResolutionInfo{OK: false},
			err:    "ref is nil",
			ctx:    ctxOrg1,
		},
	}

	for _, scenario := range scenarios {
		res, err := provider.Resolve(scenario.ctx, scenario.given)

		require.Equal(t, scenario.expect.OK, res.OK, scenario.name)
		require.Equal(t, scenario.expect.Key, res.Key, scenario.name)
		require.Equal(t, scenario.expect.Warning, res.Warning, scenario.name)

		if scenario.err != "" {
			require.Equal(t, scenario.err, err.Error(), scenario.name)
		}
	}
}
