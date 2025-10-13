package resolver

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestResolver(t *testing.T) {
	ctxOrg1 := identity.WithRequester(context.Background(), &user.SignedInUser{OrgID: 1})

	ds := &fakeDatasources.FakeDataSourceService{
		DataSources: []*datasources.DataSource{
			{
				ID:        123,
				OrgID:     1,
				Type:      "influx",
				UID:       "influx-uid",
				IsDefault: true,
			},
			{
				ID:    234,
				OrgID: 1,
				Type:  "influx",
				UID:   "influx-uid2",
				Name:  "Influx2",
			},
		},
	}

	p1 := pluginstore.Plugin{}
	p2 := pluginstore.Plugin{}
	p3 := pluginstore.Plugin{}

	p1.ID = "influx"
	p2.ID = "heatmap"
	p3.ID = "xyz"
	pluginStore := &pluginstore.FakePluginStore{
		PluginList: []pluginstore.Plugin{p1, p2, p3},
	}
	provider := ProvideEntityReferenceResolver(ds, pluginStore)

	scenarios := []struct {
		name   string
		given  *entity.EntityExternalReference
		expect ResolutionInfo
		err    string
		ctx    context.Context
	}{
		{
			name: "Missing datasource without type",
			given: &entity.EntityExternalReference{
				Family:     entity.StandardKindDataSource,
				Identifier: "xyz",
			},
			expect: ResolutionInfo{OK: false},
			ctx:    ctxOrg1,
		},
		{
			name: "OK datasource",
			given: &entity.EntityExternalReference{
				Family:     entity.StandardKindDataSource,
				Type:       "influx",
				Identifier: "influx-uid",
			},
			expect: ResolutionInfo{OK: true, Key: "influx-uid"},
			ctx:    ctxOrg1,
		},
		{
			name: "Get the default datasource",
			given: &entity.EntityExternalReference{
				Family: entity.StandardKindDataSource,
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
			given: &entity.EntityExternalReference{
				Family: entity.StandardKindDataSource,
				Type:   "influx",
			},
			expect: ResolutionInfo{
				OK:  true,
				Key: "influx-uid",
			},
			ctx: ctxOrg1,
		},
		{
			name: "Lookup by name",
			given: &entity.EntityExternalReference{
				Family:     entity.StandardKindDataSource,
				Identifier: "Influx2",
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
