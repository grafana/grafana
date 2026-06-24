package accesscontrol

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"
)

var testLogger = log.New("test")

func TestGetSearchPermissionCacheKey(t *testing.T) {
	keyInputs := []struct {
		signedInUser  *user.SignedInUser
		searchOptions SearchOptions
	}{
		{
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			searchOptions: SearchOptions{},
		},
		{
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			searchOptions: SearchOptions{
				Action: "datasources:read",
			},
		},
		{
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			searchOptions: SearchOptions{
				Scope: "datasources:*",
			},
		},
		{
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			searchOptions: SearchOptions{
				Action: "datasources:read",
				Scope:  "datasources:*",
			},
		},
		{
			signedInUser: &user.SignedInUser{
				OrgID:  1,
				UserID: 1,
			},
			searchOptions: SearchOptions{
				RolePrefixes: []string{"foo", "bar"},
			},
		},
	}

	cacheKeys := make([]string, 0, len(keyInputs))

	for _, i := range keyInputs {
		key, err := GetSearchPermissionCacheKey(testLogger, i.signedInUser, i.searchOptions)
		require.NoError(t, err)
		cacheKeys = append(cacheKeys, key)
	}

	uniqueCheck := make(map[string]bool)
	for _, str := range cacheKeys {
		require.False(t, uniqueCheck[str], "Found duplicate string: %s", str)
		uniqueCheck[str] = true
	}

	assert.Equal(t, len(cacheKeys), len(uniqueCheck), "The slice contains duplicate strings")

	t.Run("the cache key is consistent", func(t *testing.T) {
		user := &user.SignedInUser{
			OrgID:  1,
			UserID: 1,
		}
		key1, err := GetSearchPermissionCacheKey(testLogger, user, SearchOptions{
			ActionPrefix: "foobar",
			RolePrefixes: []string{"foo", "bar"},
		})
		require.NoError(t, err)
		key2, err := GetSearchPermissionCacheKey(testLogger, user, SearchOptions{
			ActionPrefix: "foobar",
			RolePrefixes: []string{"foo", "bar"},
		})
		require.NoError(t, err)
		assert.Equal(t, key1, key2, "expected search cache keys to be consistent")
	})
}
