package manager

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProvideServiceAccount_DeleteServiceAccount(t *testing.T) {
	t.Run("feature toggle present, should call store function", func(t *testing.T) {
		storeMock := &tests.ServiceAccountsStoreMock{Calls: tests.Calls{}}
		svc := ServiceAccountsService{
			features: featuremgmt.WithFeatures("serviceAccounts", true),
			store:    storeMock}
		err := svc.DeleteServiceAccount(context.Background(), 1, 1)
		require.NoError(t, err)
		assert.Len(t, storeMock.Calls.DeleteServiceAccount, 1)
	})

	t.Run("no feature toggle present, should not call store function", func(t *testing.T) {
		svcMock := &tests.ServiceAccountsStoreMock{Calls: tests.Calls{}}
		svc := ServiceAccountsService{
			features: featuremgmt.WithFeatures("serviceAccounts", false),
			store:    svcMock,
			log:      log.New("serviceaccounts-manager-test"),
		}
		err := svc.DeleteServiceAccount(context.Background(), 1, 1)
		require.NoError(t, err)
		assert.Len(t, svcMock.Calls.DeleteServiceAccount, 0)
	})
}
