package manager

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProvideServiceAccount_DeleteServiceAccount(t *testing.T) {
	t.Run("feature toggle present, should call store function", func(t *testing.T) {
		cfg := setting.NewCfg()
		storeMock := &tests.ServiceAccountsStoreMock{Calls: tests.Calls{}}
		cfg.FeatureToggles = map[string]bool{"service-accounts": true}
		svc := ServiceAccountsService{cfg: cfg, store: storeMock}
		err := svc.DeleteServiceAccount(context.Background(), 1, 1)
		require.NoError(t, err)
		assert.Len(t, storeMock.Calls.DeleteServiceAccount, 1)
	})

	t.Run("no feature toggle present, should not call store function", func(t *testing.T) {
		cfg := setting.NewCfg()
		svcMock := &tests.ServiceAccountsStoreMock{Calls: tests.Calls{}}
		cfg.FeatureToggles = map[string]bool{"service-accounts": false}
		svc := ServiceAccountsService{
			cfg:   cfg,
			store: svcMock,
			log:   log.New("serviceaccounts-manager-test"),
		}
		err := svc.DeleteServiceAccount(context.Background(), 1, 1)
		require.NoError(t, err)
		assert.Len(t, svcMock.Calls.DeleteServiceAccount, 0)
	})
}
