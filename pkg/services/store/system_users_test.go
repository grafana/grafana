package store

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestRetrievalOfNotInitializedOrg(t *testing.T) {
	service := ProvideSystemUsersService()

	orgID := int64(1)
	user, err := service.GetUser(ReportsAdmin, orgID)
	require.NoError(t, err)

	require.Equal(t, string(ReportsAdmin), user.Login)
	require.Equal(t, orgID, user.OrgID)

	userFromSubsequentCall, err := service.GetUser(ReportsAdmin, orgID)
	require.Same(t, user, userFromSubsequentCall)
}

func TestRetrievalOfFilterForInitializedUser(t *testing.T) {
	service := ProvideSystemUsersService()

	orgID := int64(1)
	reportsAdminUser, err := service.GetUser(ReportsAdmin, orgID)
	require.NoError(t, err)

	filter, err := service.GetFilter(reportsAdminUser)
	require.NoError(t, err)
	require.NotNil(t, filter)
}

func TestRetrievalOfFilterForNotInitializedUser(t *testing.T) {
	service := ProvideSystemUsersService()

	orgID := int64(1)

	filter, err := service.GetFilter(&user.SignedInUser{
		OrgID: orgID,
		Login: string(ReportsAdmin),
	})
	require.Error(t, err)
	require.Nil(t, filter)
}
