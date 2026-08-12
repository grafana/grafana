package store

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/services/user"
)

const admin SystemUserType = "storageAdmin"

func TestRetrievalOfNotInitializedOrg(t *testing.T) {
	service := setupSystemUsers()

	orgID := int64(1)
	user, err := service.GetUser(admin, orgID)
	require.NoError(t, err)

	require.Equal(t, string(admin), user.Login)
	require.Equal(t, orgID, user.OrgID)

	userFromSubsequentCall, err := service.GetUser(admin, orgID)
	require.NoError(t, err)
	require.Same(t, user, userFromSubsequentCall)
}

func TestRetrievalOfFilterForInitializedUser(t *testing.T) {
	service := setupSystemUsers()

	orgID := int64(1)
	reportsAdminUser, err := service.GetUser(admin, orgID)
	require.NoError(t, err)

	filter, err := service.GetFilter(reportsAdminUser)
	require.NoError(t, err)
	require.NotNil(t, filter)
}

func TestRetrievalOfFilterForNotInitializedUser(t *testing.T) {
	service := setupSystemUsers()

	orgID := int64(1)

	filter, err := service.GetFilter(&user.SignedInUser{
		OrgID: orgID,
		Login: string(admin),
	})
	require.Error(t, err)
	require.Nil(t, filter)
}

func setupSystemUsers() SystemUsers {
	service := ProvideSystemUsersService()

	service.RegisterUser(admin, func() map[string]filestorage.PathFilter {
		return map[string]filestorage.PathFilter{
			ActionFilesRead: denyAllPathFilter,
		}
	})

	return service
}
