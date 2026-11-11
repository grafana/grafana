package teamapi

import (
	"testing"

	"github.com/stretchr/testify/require"

	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
)

func TestUsersAPIEnabledUsesResolvedStartupFeatures(t *testing.T) {
	require.True(t, (&TeamAPI{iamFeatures: iamapi.Features{UsersAPI: true}}).usersAPIEnabled())
	require.False(t, (&TeamAPI{iamFeatures: iamapi.Features{}}).usersAPIEnabled())
}
