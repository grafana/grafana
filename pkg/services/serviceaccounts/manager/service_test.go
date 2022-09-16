package manager

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/serviceaccounts/tests"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestProvideServiceAccount_DeleteServiceAccount(t *testing.T) {
	t.Run("should call store function", func(t *testing.T) {
		storeMock := &tests.ServiceAccountsStoreMock{Calls: tests.Calls{}}
		svc := ServiceAccountsService{store: storeMock}
		err := svc.DeleteServiceAccount(context.Background(), 1, 1)
		require.NoError(t, err)
		assert.Len(t, storeMock.Calls.DeleteServiceAccount, 1)
	})
}
