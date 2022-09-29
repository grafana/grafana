package service

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	acmock "github.com/grafana/grafana/pkg/services/accesscontrol/mock"
	"github.com/grafana/grafana/pkg/services/datasources"
	datasourceservice "github.com/grafana/grafana/pkg/services/datasources/service"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretskvs "github.com/grafana/grafana/pkg/services/secrets/kvstore"
	secretsmng "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

func TestHandleRequest(t *testing.T) {
	cfg := &setting.Cfg{}

	t.Run("Should invoke plugin manager QueryData when handling request for query", func(t *testing.T) {
		origOAuthIsOAuthPassThruEnabledFunc := oAuthIsOAuthPassThruEnabledFunc
		oAuthIsOAuthPassThruEnabledFunc = func(oAuthTokenService oauthtoken.OAuthTokenService, ds *datasources.DataSource) bool {
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
		sqlStore := sqlstore.InitTestDB(t)
		secretsService := secretsmng.SetupTestService(t, fakes.NewFakeSecretsStore())
		secretsStore := secretskvs.NewSQLSecretsKVStore(sqlStore, secretsService, log.New("test.logger"))
		datasourcePermissions := acmock.NewMockedPermissionsService()
		dsService := datasourceservice.ProvideService(nil, secretsService, secretsStore, cfg, featuremgmt.WithFeatures(), acmock.New(), datasourcePermissions)
		s := ProvideService(client, nil, dsService)

		ds := &datasources.DataSource{Id: 12, Type: "unregisteredType", JsonData: simplejson.New()}
		req := legacydata.DataQuery{
			TimeRange: &legacydata.DataTimeRange{},
			Queries: []legacydata.DataSubQuery{
				{RefID: "A", DataSource: &datasources.DataSource{Id: 1, Type: "test"}, Model: simplejson.New()},
				{RefID: "B", DataSource: &datasources.DataSource{Id: 1, Type: "test"}, Model: simplejson.New()},
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
