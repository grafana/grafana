package tsdb

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
)

func TestHandleRequest(t *testing.T) {
	t.Run("Should invoke plugin manager QueryData when handling request for query", func(t *testing.T) {
		svc, _, pm := createService(t)
		backendPluginManagerCalled := false
		pm.QueryDataHandlerFunc = func(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
			backendPluginManagerCalled = true
			return backend.NewQueryDataResponse(), nil
		}

		ds := &models.DataSource{Id: 12, Type: "unregisteredType", JsonData: simplejson.New()}
		req := plugins.DataQuery{
			TimeRange: &plugins.DataTimeRange{},
			Queries: []plugins.DataSubQuery{
				{RefID: "A", DataSource: &models.DataSource{Id: 1, Type: "test"}, Model: simplejson.New()},
				{RefID: "B", DataSource: &models.DataSource{Id: 1, Type: "test"}, Model: simplejson.New()},
			},
		}
		_, err := svc.HandleRequest(context.Background(), ds, req)
		require.NoError(t, err)
		require.True(t, backendPluginManagerCalled)
	})
}

//nolint: staticcheck // plugins.DataPlugin deprecated
type resultsFn func(context plugins.DataQuery) plugins.DataQueryResult

type fakeExecutor struct {
	//nolint: staticcheck // plugins.DataPlugin deprecated
	results   map[string]plugins.DataQueryResult
	resultsFn map[string]resultsFn
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func (e *fakeExecutor) DataQuery(ctx context.Context, dsInfo *models.DataSource, context plugins.DataQuery) (
	plugins.DataResponse, error) {
	result := plugins.DataResponse{Results: make(map[string]plugins.DataQueryResult)}
	for _, query := range context.Queries {
		if results, has := e.results[query.RefID]; has {
			result.Results[query.RefID] = results
		}
		if testFunc, has := e.resultsFn[query.RefID]; has {
			result.Results[query.RefID] = testFunc(context)
		}
	}

	return result, nil
}

func (e *fakeExecutor) Return(refID string, series plugins.DataTimeSeriesSlice) {
	//nolint: staticcheck // plugins.DataPlugin deprecated
	e.results[refID] = plugins.DataQueryResult{
		RefID: refID, Series: series,
	}
}

func (e *fakeExecutor) HandleQuery(refId string, fn resultsFn) {
	e.resultsFn[refId] = fn
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

type fakeOAuthTokenService struct {
}

func (s *fakeOAuthTokenService) GetCurrentOAuthToken(context.Context, *models.SignedInUser) *oauth2.Token {
	return nil
}

func (s *fakeOAuthTokenService) IsOAuthPassThruEnabled(*models.DataSource) bool {
	return false
}

func createService(t *testing.T) (*Service, *fakeExecutor, *fakePluginsClient) {
	fakePluginsClient := &fakePluginsClient{}
	secretsService := secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore())
	dsService := datasources.ProvideService(bus.New(), nil, secretsService)

	s := newService(
		setting.NewCfg(),
		fakePluginsClient,
		&fakeOAuthTokenService{},
		dsService,
	)
	e := &fakeExecutor{
		//nolint: staticcheck // plugins.DataPlugin deprecated
		results:   make(map[string]plugins.DataQueryResult),
		resultsFn: make(map[string]resultsFn),
	}

	return s, e, fakePluginsClient
}
