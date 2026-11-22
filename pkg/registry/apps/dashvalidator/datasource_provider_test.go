package dashvalidator

import (
	"context"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	validatorapp "github.com/grafana/grafana/apps/dashvalidator/pkg/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/datasources"
	dsfakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
)

func TestDatasourceProvider_CanQuery(t *testing.T) {
	p := &datasourceProvider{ac: acimpl.ProvideAccessControl(nil)}

	userWith := func(perms map[string][]string) identity.Requester {
		return &identity.StaticRequester{
			OrgRole:     authlib.RoleEditor,
			UserID:      1,
			OrgID:       1,
			Permissions: map[int64]map[string][]string{1: perms},
		}
	}

	tests := []struct {
		name     string
		user     identity.Requester
		expected bool
	}{
		{
			name: "read and query on the datasource",
			user: userWith(map[string][]string{
				datasources.ActionRead:  {"datasources:uid:target-ds"},
				datasources.ActionQuery: {"datasources:uid:target-ds"},
			}),
			expected: true,
		},
		{
			name: "read and query on a different datasource",
			user: userWith(map[string][]string{
				datasources.ActionRead:  {"datasources:uid:other-ds"},
				datasources.ActionQuery: {"datasources:uid:other-ds"},
			}),
			expected: false,
		},
		{
			name: "read without query",
			user: userWith(map[string][]string{
				datasources.ActionRead: {"datasources:uid:target-ds"},
			}),
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ok, err := p.CanQuery(context.Background(), tt.user, "target-ds")
			require.NoError(t, err)
			assert.Equal(t, tt.expected, ok)
		})
	}
}

func TestDatasourceProvider_Get(t *testing.T) {
	svc := &dsfakes.FakeDataSourceService{
		DataSources: []*datasources.DataSource{
			{UID: "prom", Type: "prometheus", OrgID: 1, URL: "http://prom:9090"},
		},
	}
	p := &datasourceProvider{svc: svc, httpClientProvider: httpclient.NewProvider()}

	t.Run("found", func(t *testing.T) {
		ds, err := p.Get(context.Background(), "default", "prom", "prometheus")
		require.NoError(t, err)
		assert.Equal(t, "prom", ds.UID)
		assert.Equal(t, "prometheus", ds.Type)
		assert.Equal(t, "http://prom:9090", ds.URL)

		rt, err := ds.Transport(context.Background())
		require.NoError(t, err)
		assert.NotNil(t, rt)
	})

	t.Run("not found maps to app error", func(t *testing.T) {
		_, err := p.Get(context.Background(), "default", "missing", "prometheus")
		require.ErrorIs(t, err, validatorapp.ErrDatasourceNotFound)
	})
}
