package shorturlimpl

import (
	"context"
	"fmt"
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

	testUser := &user.SignedInUser{UserID: 1}
	store := db.InitTestDB(t)

	t.Run("User can create and read short URLs", func(t *testing.T) {
		cmd := &dtos.CreateShortURLCmd{
			Path: "mock/path?test=true",
		}

		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		newShortURL, err := service.CreateShortURL(context.Background(), testUser, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL)
		require.NotEmpty(t, newShortURL.Uid)

		existingShortURL, err := service.GetShortURLByUID(context.Background(), testUser, newShortURL.Uid)
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

			updatedShortURL, err := service.GetShortURLByUID(context.Background(), testUser, existingShortURL.Uid)
			require.NoError(t, err)
			require.Equal(t, expectedTime.Unix(), updatedShortURL.LastSeenAt)
		})

		t.Run("and stale short urls can be deleted", func(t *testing.T) {
			// Use a custom UID to bypass de-duplication and create a new stale URL
			staleCmd := &dtos.CreateShortURLCmd{
				Path: cmd.Path,
				UID:  "stale-url-uid",
			}
			staleShortURL, err := service.CreateShortURL(context.Background(), testUser, staleCmd)
			require.NoError(t, err)
			require.NotNil(t, staleShortURL)
			require.NotEmpty(t, staleShortURL.Uid)
			require.Equal(t, int64(0), staleShortURL.LastSeenAt)

			cmd := shorturls.DeleteShortUrlCommand{OlderThan: time.Unix(staleShortURL.CreatedAt, 0)}
			err = service.DeleteStaleShortURLs(context.Background(), &cmd)
			require.NoError(t, err)
			require.Equal(t, int64(1), cmd.NumDeleted)

			t.Run("and previously accessed short urls will still exist", func(t *testing.T) {
				updatedShortURL, err := service.GetShortURLByUID(context.Background(), testUser, existingShortURL.Uid)
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

		shortURL, err := service.GetShortURLByUID(context.Background(), testUser, "testnotfounduid")
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

		newShortURL, err := service.CreateShortURL(ctx, testUser, cmd)
		require.ErrorIs(t, err, shorturls.ErrShortURLAbsolutePath)
		require.Nil(t, newShortURL)

		cmd2 := &dtos.CreateShortURLCmd{
			Path: "path/../test?test=true",
		}
		newShortURL, err = service.CreateShortURL(ctx, testUser, cmd2)
		require.ErrorIs(t, err, shorturls.ErrShortURLInvalidPath)
		require.Nil(t, newShortURL)

		cmd3 := &dtos.CreateShortURLCmd{
			Path: "../path/test?test=true",
		}
		newShortURL, err = service.CreateShortURL(ctx, testUser, cmd3)
		require.ErrorIs(t, err, shorturls.ErrShortURLInvalidPath)
		require.Nil(t, newShortURL)
	})

	t.Run("The same URL will return the same entry (de-duplication)", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		cmd := &dtos.CreateShortURLCmd{
			Path: "mock/path?test=true",
		}
		newShortURL1, err := service.CreateShortURL(ctx, testUser, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.NotEmpty(t, newShortURL1.Uid)
		require.NotEmpty(t, newShortURL1.Signature)

		newShortURL2, err := service.CreateShortURL(ctx, testUser, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL2)

		// Should return the same short URL (de-duplication)
		require.Equal(t, newShortURL1.Uid, newShortURL2.Uid)
		require.Equal(t, newShortURL1.Path, newShortURL2.Path)
		require.Equal(t, newShortURL1.Signature, newShortURL2.Signature)
	})

	t.Run("Path normalization: different query param orders produce same signature", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		cmd1 := &dtos.CreateShortURLCmd{
			Path: "mock/path?a=1&b=2",
		}
		newShortURL1, err := service.CreateShortURL(ctx, testUser, cmd1)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.NotEmpty(t, newShortURL1.Signature)

		cmd2 := &dtos.CreateShortURLCmd{
			Path: "mock/path?b=2&a=1",
		}
		newShortURL2, err := service.CreateShortURL(ctx, testUser, cmd2)
		require.NoError(t, err)
		require.NotNil(t, newShortURL2)

		// Should return the same short URL due to path normalization
		require.Equal(t, newShortURL1.Uid, newShortURL2.Uid)
		require.Equal(t, newShortURL1.Signature, newShortURL2.Signature)
	})

	t.Run("Time normalization: absolute timestamps with same relative range produce same signature", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		// Simulate two absolute timestamps that represent the same relative range (now-6h to now)
		// These would be created a few seconds apart
		now := time.Now()
		from1 := now.Add(-6 * time.Hour).Add(-10 * time.Second)
		to1 := now.Add(-10 * time.Second)
		from2 := now.Add(-6 * time.Hour).Add(-5 * time.Second)
		to2 := now.Add(-5 * time.Second)

		cmd1 := &dtos.CreateShortURLCmd{
			Path: fmt.Sprintf("d/test-dashboard?orgId=1&from=%s&to=%s&timezone=browser",
				from1.Format(time.RFC3339), to1.Format(time.RFC3339)),
		}
		newShortURL1, err := service.CreateShortURL(ctx, testUser, cmd1)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.NotEmpty(t, newShortURL1.Signature)

		cmd2 := &dtos.CreateShortURLCmd{
			Path: fmt.Sprintf("d/test-dashboard?orgId=1&from=%s&to=%s&timezone=browser",
				from2.Format(time.RFC3339), to2.Format(time.RFC3339)),
		}
		newShortURL2, err := service.CreateShortURL(ctx, testUser, cmd2)
		require.NoError(t, err)
		require.NotNil(t, newShortURL2)

		// Should return the same short URL due to time normalization
		// Both represent "now-6h to now" so they should have the same signature
		require.Equal(t, newShortURL1.Uid, newShortURL2.Uid)
		require.Equal(t, newShortURL1.Signature, newShortURL2.Signature)
	})

	t.Run("Time normalization: old absolute timestamps are not normalized", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		// Old timestamps (more than 24 hours ago) should not be normalized
		oldTime := time.Now().Add(-48 * time.Hour)
		oldFrom := oldTime.Add(-6 * time.Hour)
		oldTo := oldTime

		cmd1 := &dtos.CreateShortURLCmd{
			Path: fmt.Sprintf("d/test-dashboard?orgId=1&from=%s&to=%s",
				oldFrom.Format(time.RFC3339), oldTo.Format(time.RFC3339)),
		}
		newShortURL1, err := service.CreateShortURL(ctx, testUser, cmd1)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.NotEmpty(t, newShortURL1.Signature)

		// Create another with slightly different old timestamp
		oldFrom2 := oldTime.Add(-6 * time.Hour).Add(1 * time.Minute)
		oldTo2 := oldTime.Add(1 * time.Minute)

		cmd2 := &dtos.CreateShortURLCmd{
			Path: fmt.Sprintf("d/test-dashboard?orgId=1&from=%s&to=%s",
				oldFrom2.Format(time.RFC3339), oldTo2.Format(time.RFC3339)),
		}
		newShortURL2, err := service.CreateShortURL(ctx, testUser, cmd2)
		require.NoError(t, err)
		require.NotNil(t, newShortURL2)

		// Old timestamps should NOT be normalized, so they should have different signatures
		require.NotEqual(t, newShortURL1.Uid, newShortURL2.Uid)
		require.NotEqual(t, newShortURL1.Signature, newShortURL2.Signature)
	})

	t.Run("Time normalization: relative time ranges are preserved", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		cmd1 := &dtos.CreateShortURLCmd{
			Path: "d/test-dashboard?orgId=1&from=now-6h&to=now&timezone=browser",
		}
		newShortURL1, err := service.CreateShortURL(ctx, testUser, cmd1)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.NotEmpty(t, newShortURL1.Signature)

		cmd2 := &dtos.CreateShortURLCmd{
			Path: "d/test-dashboard?orgId=1&from=now-6h&to=now&timezone=browser",
		}
		newShortURL2, err := service.CreateShortURL(ctx, testUser, cmd2)
		require.NoError(t, err)
		require.NotNil(t, newShortURL2)

		// Relative time ranges should produce the same signature
		require.Equal(t, newShortURL1.Uid, newShortURL2.Uid)
		require.Equal(t, newShortURL1.Signature, newShortURL2.Signature)
	})

	t.Run("Different orgs: same path creates different short URLs", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		user1 := &user.SignedInUser{UserID: 1, OrgID: 1}
		user2 := &user.SignedInUser{UserID: 2, OrgID: 2}

		cmd := &dtos.CreateShortURLCmd{
			Path: "mock/path?test=true",
		}
		newShortURL1, err := service.CreateShortURL(ctx, user1, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.NotEmpty(t, newShortURL1.Uid)

		newShortURL2, err := service.CreateShortURL(ctx, user2, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL2)
		require.NotEmpty(t, newShortURL2.Uid)

		// Should create different short URLs for different orgs
		require.NotEqual(t, newShortURL1.Uid, newShortURL2.Uid)
		require.NotEqual(t, newShortURL1.Signature, newShortURL2.Signature)
		require.Equal(t, newShortURL1.Path, newShortURL2.Path)
	})

	t.Run("Custom UID bypasses de-duplication", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		cmd1 := &dtos.CreateShortURLCmd{
			Path: "mock/path?test=true",
			UID:  "custom-uid-3",
		}
		newShortURL1, err := service.CreateShortURL(ctx, testUser, cmd1)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.Equal(t, "custom-uid-3", newShortURL1.Uid)
		require.NotEmpty(t, newShortURL1.Signature) // Custom UID has signature including UID

		cmd2 := &dtos.CreateShortURLCmd{
			Path: "mock/path?test=true",
			UID:  "custom-uid-4",
		}
		newShortURL2, err := service.CreateShortURL(ctx, testUser, cmd2)
		require.NoError(t, err)
		require.NotNil(t, newShortURL2)
		require.Equal(t, "custom-uid-4", newShortURL2.Uid)
		require.NotEmpty(t, newShortURL2.Signature) // Custom UID has signature including UID

		// Different UIDs, same path - both created because UID was provided
		// Signatures should be different because they include the UID
		require.NotEqual(t, newShortURL1.Uid, newShortURL2.Uid)
		require.NotEqual(t, newShortURL1.Signature, newShortURL2.Signature)
	})

	t.Run("Create URL providing the UID", func(t *testing.T) {
		service := ShortURLService{SQLStore: &sqlStore{db: store}}

		ctx := context.Background()

		cmd := &dtos.CreateShortURLCmd{
			Path: "mock/path?test=true",
			UID:  "custom-uid",
		}
		newShortURL1, err := service.CreateShortURL(ctx, testUser, cmd)
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
		newShortURL1, err := service.CreateShortURL(ctx, testUser, cmd)
		require.NoError(t, err)
		require.NotNil(t, newShortURL1)
		require.Equal(t, cmd.UID, newShortURL1.Uid)

		newShortURL2, err := service.CreateShortURL(ctx, testUser, cmd)
		require.ErrorIs(t, err, shorturls.ErrShortURLConflict)
		require.Nil(t, newShortURL2)
	})
}
