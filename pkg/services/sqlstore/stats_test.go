// +build integration

package sqlstore

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStatsDataAccess(t *testing.T) {
	sqlStore := InitTestDB(t)
	populateDB(t)

	t.Run("Get system stats should not results in error", func(t *testing.T) {
		query := models.GetSystemStatsQuery{}
		err := GetSystemStats(&query)
		require.NoError(t, err)
		assert.Equal(t, int64(3), query.Result.Users)
		assert.Equal(t, 0, query.Result.Editors)
		assert.Equal(t, 0, query.Result.Viewers)
		assert.Equal(t, 3, query.Result.Admins)
	})

	t.Run("Get system user count stats should not results in error", func(t *testing.T) {
		query := models.GetSystemUserCountStatsQuery{}
		err := GetSystemUserCountStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get datasource stats should not results in error", func(t *testing.T) {
		query := models.GetDataSourceStatsQuery{}
		err := GetDataSourceStats(&query)
		assert.NoError(t, err)
	})

	t.Run("Get datasource access stats should not results in error", func(t *testing.T) {
		query := models.GetDataSourceAccessStatsQuery{}
		err := GetDataSourceAccessStats(&query)
		assert.NoError(t, err)
	})

	t.Run("Get alert notifier stats should not results in error", func(t *testing.T) {
		query := models.GetAlertNotifierUsageStatsQuery{}
		err := GetAlertNotifiersUsageStats(context.Background(), &query)
		assert.NoError(t, err)
	})

	t.Run("Get admin stats should not result in error", func(t *testing.T) {
		query := models.GetAdminStatsQuery{}
		err := GetAdminStats(&query)
		assert.NoError(t, err)
	})

	t.Run("Get active user count stats should not result in error", func(t *testing.T) {
		query := models.GetUserStatsQuery{
			MustUpdate: true,
			Active:     true,
		}
		err := GetUserStats(context.Background(), &query)
		require.NoError(t, err)
		assert.Equal(t, int64(1), query.Result.Users)
		assert.Equal(t, int64(1), query.Result.Admins)
		assert.Equal(t, int64(0), query.Result.Editors)
		assert.Equal(t, int64(0), query.Result.Viewers)
	})

	t.Run("Get concurrent users stats should return a histogram", func(t *testing.T) {
		for u := 1; u <= 5; u++ {
			for tkn := 1; tkn <= u*4; tkn++ {
				err := createToken(u, sqlStore)
				assert.NoError(t, err)
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		t.Cleanup(func() {
			cancel()
		})

		t.Run("Should refresh stats when forced", func(t *testing.T) {
			query := models.GetConcurrentUsersStatsQuery{}
			err := GetConcurrentUsersStats(ctx, &query)
			require.NoError(t, err)

			expectedResult := []*models.ConcurrentUsersStats{
				{
					BucketActiveTokens: 5,
					Count:              1,
				},
				{
					BucketActiveTokens: 10,
					Count:              1,
				},
				{
					BucketActiveTokens: 15,
					Count:              1,
				},
				{
					BucketActiveTokens: 20,
					Count:              2,
				},
			}
			assert.ElementsMatch(t, query.Result, expectedResult, "Expecting concurrent users buckets and counts to match")

			err = createToken(6, sqlStore)
			assert.NoError(t, err)

			query = models.GetConcurrentUsersStatsQuery{MustRefresh: true}
			err = GetConcurrentUsersStats(ctx, &query)
			require.NoError(t, err)

			expectedResult = []*models.ConcurrentUsersStats{
				{
					BucketActiveTokens: 5,
					Count:              2,
				},
				{
					BucketActiveTokens: 10,
					Count:              1,
				},
				{
					BucketActiveTokens: 15,
					Count:              1,
				},
				{
					BucketActiveTokens: 20,
					Count:              2,
				},
			}

			assert.ElementsMatch(t, query.Result, expectedResult, "Expecting updated data, but received cached results")
		})

		t.Run("Should cache results", func(t *testing.T) {
			query := models.GetConcurrentUsersStatsQuery{}
			err := GetConcurrentUsersStats(ctx, &query)
			require.NoError(t, err)

			expectedCachedResult := []*models.ConcurrentUsersStats{
				{
					BucketActiveTokens: 5,
					Count:              2,
				},
				{
					BucketActiveTokens: 10,
					Count:              1,
				},
				{
					BucketActiveTokens: 15,
					Count:              1,
				},
				{
					BucketActiveTokens: 20,
					Count:              2,
				},
			}
			assert.ElementsMatch(t, query.Result, expectedCachedResult, "Expecting concurrent users buckets and counts to match")

			err = createToken(7, sqlStore)
			assert.NoError(t, err)

			query = models.GetConcurrentUsersStatsQuery{}
			err = GetConcurrentUsersStats(ctx, &query)
			require.NoError(t, err)

			assert.ElementsMatch(t, query.Result, expectedCachedResult, "Expecting cached results, but received updated data")
		})
	})
}

func createToken(uId int, sqlStore *SQLStore) error {
	token, err := util.RandomHex(16)
	if err != nil {
		return err
	}
	tokenWithSecret := fmt.Sprintf("%ssecret%d", token, uId)
	hashBytes := sha256.Sum256([]byte(tokenWithSecret))
	hashedToken := hex.EncodeToString(hashBytes[:])

	now := getTime().Unix()

	userAuthToken := userAuthToken{
		UserId:        int64(uId),
		AuthToken:     hashedToken,
		PrevAuthToken: hashedToken,
		ClientIp:      "192.168.10.11",
		UserAgent:     "Mozilla",
		RotatedAt:     now,
		CreatedAt:     now,
		UpdatedAt:     now,
		SeenAt:        0,
		AuthTokenSeen: false,
	}

	err = sqlStore.WithDbSession(context.Background(), func(dbSession *DBSession) error {
		_, err = dbSession.Insert(&userAuthToken)
		return err
	})

	return nil
}

type userAuthToken struct {
	Id            int64
	UserId        int64
	AuthToken     string
	PrevAuthToken string
	UserAgent     string
	ClientIp      string
	AuthTokenSeen bool
	SeenAt        int64
	RotatedAt     int64
	CreatedAt     int64
	UpdatedAt     int64
	UnhashedToken string `xorm:"-"`
}

func populateDB(t *testing.T) {
	users := make([]models.User, 3)
	for i := range users {
		cmd := &models.CreateUserCommand{
			Email:   fmt.Sprintf("usertest%v@test.com", i),
			Name:    fmt.Sprintf("user name %v", i),
			Login:   fmt.Sprintf("user_test_%v_login", i),
			OrgName: fmt.Sprintf("Org #%v", i),
		}
		err := CreateUser(context.Background(), cmd)
		require.NoError(t, err)
		users[i] = cmd.Result
	}

	// get 1st user's organisation
	getOrgByIdQuery := &models.GetOrgByIdQuery{Id: users[0].OrgId}
	err := GetOrgById(getOrgByIdQuery)
	require.NoError(t, err)
	org := getOrgByIdQuery.Result

	// add 2nd user as editor
	cmd := &models.AddOrgUserCommand{
		OrgId:  org.Id,
		UserId: users[1].Id,
		Role:   models.ROLE_EDITOR,
	}
	err = AddOrgUser(cmd)
	require.NoError(t, err)

	// add 3rd user as viewer
	cmd = &models.AddOrgUserCommand{
		OrgId:  org.Id,
		UserId: users[2].Id,
		Role:   models.ROLE_VIEWER,
	}
	err = AddOrgUser(cmd)
	require.NoError(t, err)

	// get 2nd user's organisation
	getOrgByIdQuery = &models.GetOrgByIdQuery{Id: users[1].OrgId}
	err = GetOrgById(getOrgByIdQuery)
	require.NoError(t, err)
	org = getOrgByIdQuery.Result

	// add 1st user as admin
	cmd = &models.AddOrgUserCommand{
		OrgId:  org.Id,
		UserId: users[0].Id,
		Role:   models.ROLE_ADMIN,
	}
	err = AddOrgUser(cmd)
	require.NoError(t, err)

	// update 1st user last seen at
	updateUserLastSeenAtCmd := &models.UpdateUserLastSeenAtCommand{
		UserId: users[0].Id,
	}
	err = UpdateUserLastSeenAt(updateUserLastSeenAtCmd)
	require.NoError(t, err)

	// force renewal of user stats
	query := models.GetUserStatsQuery{
		MustUpdate: true,
		Active:     true,
	}
	err = GetUserStats(context.Background(), &query)
	require.NoError(t, err)
}
