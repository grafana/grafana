package shorturlimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationShortURLService(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	user := &user.SignedInUser{UserID: 1}
	store := db.InitTestDB(t)

	t.Run("User can create and read short URLs", func(t *testing.T) {
		cmd := &dtos.CreateShortURLCmd{
			Path: "mock/path?test=true",
		}

		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		newShortURL, err := service.CreateShortURL(context.Background(), user, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL)
		require.NotEmpty(t, newShortURL.Uid)

		existingShortURL, err := service.GetShortURLByUID(context.Background(), user, newShortURL.Uid)
		require.NoError(t, err)
		require.NotNil(t, existingShortURL)
		require.Equal(t, cmd.Path, existingShortURL.Path)

		t.Run("and update last seen at", func(t *testing.T) {
			origGetTime := getTime
			t.Cleanup(func() {
				getTime = origGetTime
			})

			expectedTime := time.Date(2020, time.November, 27, 6, 5, 1, 0, time.UTC)
			getTime = func() time.Time {
				return expectedTime
			}

			err := service.UpdateLastSeenAt(context.Background(), existingShortURL)
			require.NoError(t, err)

			updatedShortURL, err := service.GetShortURLByUID(context.Background(), user, existingShortURL.Uid)
			require.NoError(t, err)
			require.Equal(t, expectedTime.Unix(), updatedShortURL.LastSeenAt)
		})

		t.Run("and stale short urls can be deleted", func(t *testing.T) {
			staleShortURL, err := service.CreateShortURL(context.Background(), user, cmd)
			require.NoError(t, err)
			require.NotNil(t, staleShortURL)
			require.NotEmpty(t, staleShortURL.Uid)
			require.Equal(t, int64(0), staleShortURL.LastSeenAt)

			cmd := shorturls.DeleteShortUrlCommand{OlderThan: time.Unix(staleShortURL.CreatedAt, 0)}
			err = service.DeleteStaleShortURLs(context.Background(), &cmd)
			require.NoError(t, err)
			require.Equal(t, int64(1), cmd.NumDeleted)

			t.Run("and previously accessed short urls will still exist", func(t *testing.T) {
				updatedShortURL, err := service.GetShortURLByUID(context.Background(), user, existingShortURL.Uid)
				require.NoError(t, err)
				require.NotNil(t, updatedShortURL)
			})

			t.Run("and no action when no stale short urls exist", func(t *testing.T) {
				cmd := shorturls.DeleteShortUrlCommand{OlderThan: time.Unix(existingShortURL.CreatedAt, 0)}

				err = service.DeleteStaleShortURLs(context.Background(), &cmd)
				require.NoError(t, err)
				require.Equal(t, int64(0), cmd.NumDeleted)
			})
		})
	})

	t.Run("User cannot look up nonexistent short URLs", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		shortURL, err := service.GetShortURLByUID(context.Background(), user, "testnotfounduid")
		require.Error(t, err)
		require.True(t, shorturls.ErrShortURLNotFound.Is(err))
		require.Nil(t, shortURL)
	})

	t.Run("User cannot create short URLs from invalid paths", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		cmd := &dtos.CreateShortURLCmd{
			Path: "/path?test=true",
		}

		newShortURL, err := service.CreateShortURL(ctx, user, cmd)
		require.ErrorIs(t, err, shorturls.ErrShortURLAbsolutePath)
		require.Nil(t, newShortURL)

		cmd2 := &dtos.CreateShortURLCmd{
			Path: "path/../test?test=true",
		}
		newShortURL, err = service.CreateShortURL(ctx, user, cmd2)
		require.ErrorIs(t, err, shorturls.ErrShortURLInvalidPath)
		require.Nil(t, newShortURL)

		cmd3 := &dtos.CreateShortURLCmd{
			Path: "../path/test?test=true",
		}
		newShortURL, err = service.CreateShortURL(ctx, user, cmd3)
		require.ErrorIs(t, err, shorturls.ErrShortURLInvalidPath)
		require.Nil(t, newShortURL)
	})

	t.Run("The same URL will generate different entries", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		cmd := &dtos.CreateShortURLCmd{
			Path: "mock/path?test=true",
		}
		newShortURL1, err := service.CreateShortURL(ctx, user, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.NotEmpty(t, newShortURL1.Uid)

		newShortURL2, err := service.CreateShortURL(ctx, user, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL2)
		require.NotEmpty(t, newShortURL2.Uid)

		require.NotEqual(t, newShortURL1.Uid, newShortURL2.Uid)
		require.Equal(t, newShortURL1.Path, newShortURL2.Path)
	})

	t.Run("Create URL providing the UID", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		cmd := &dtos.CreateShortURLCmd{
			Path: "mock/path?test=true",
			UID:  "custom-uid",
		}
		newShortURL1, err := service.CreateShortURL(ctx, user, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.Equal(t, cmd.UID, newShortURL1.Uid)
	})

	t.Run("Create URL providing an existing UID should fail", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		cmd := &dtos.CreateShortURLCmd{
			Path: "mock/path?test=true",
			UID:  "custom-uid-2",
		}
		newShortURL1, err := service.CreateShortURL(ctx, user, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.Equal(t, cmd.UID, newShortURL1.Uid)

		newShortURL2, err := service.CreateShortURL(ctx, user, cmd)
		require.ErrorIs(t, err, shorturls.ErrShortURLConflict)
		require.Nil(t, newShortURL2)
	})
}
