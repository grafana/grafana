package service

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/stretchr/testify/require"
)

func TestHandleRequest(t *testing.T) {
	t.Run("Should invoke plugin manager QueryData when handling request for query", func(t *testing.T) {
		origOAuthIsOAuthPassThruEnabledFunc := oAuthIsOAuthPassThruEnabledFunc
		oAuthIsOAuthPassThruEnabledFunc = func(oAuthTokenService oauthtoken.OAuthTokenService, ds *models.DataSource) bool {
			return false
		}

		t.Cleanup(func() {
			oAuthIsOAuthPassThruEnabledFunc = origOAuthIsOAuthPassThruEnabledFunc
		})

		client := &fakePluginsClient{}
		var actualReq *backend.QueryDataRequest
		client.QueryDataHandlerFunc = func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			actualReq = req
			return backend.NewQueryDataResponse(), nil
		}
		secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
		dsService := datasources.ProvideService(bus.New(), nil, secretsService)
		s := ProvideService(client, nil, dsService)

		ds := &models.DataSource{Id: 12, Type: "unregisteredType", JsonData: simplejson.New()}
		req := legacydata.DataQuery{
			TimeRange: &legacydata.DataTimeRange{},
			Queries: []legacydata.DataSubQuery{
				{RefID: "A", DataSource: &models.DataSource{Id: 1, Type: "test"}, Model: simplejson.New()},
				{RefID: "B", DataSource: &models.DataSource{Id: 1, Type: "test"}, Model: simplejson.New()},
			},
		}
		res, err := s.HandleRequest(context.Background(), ds, req)
		require.NoError(t, err)
		require.NotNil(t, actualReq)
		require.NotNil(t, res)
	})
}

type fakePluginsClient struct {
	plugins.Client
	backend.QueryDataHandlerFunc
}

func (m *fakePluginsClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if m.QueryDataHandlerFunc != nil {
		return m.QueryDataHandlerFunc.QueryData(ctx, req)
	}

	return nil, nil
}
