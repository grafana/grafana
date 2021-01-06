package usagestats

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUsageStatsService_GetConcurrentUsersStats(t *testing.T) {
	sqlStore := sqlstore.InitTestDB(t)
	uss := &UsageStatsService{
		Bus:      bus.New(),
		SQLStore: sqlStore,
		License:  &licensing.OSSLicensingService{},
	}
	t.Run("Get concurrent users stats should return a histogram", func(t *testing.T) {
		createConcurrentTokens(t, sqlStore)

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		t.Cleanup(func() {
			cancel()
		})

		t.Run("Should cache results", func(t *testing.T) {
			actualResult, err := uss.GetConcurrentUsersStats(ctx)
			require.NoError(t, err)

			expectedCachedResult := &concurrentUsersStats{
				BucketLE3:   1,
				BucketLE6:   2,
				BucketLE9:   3,
				BucketLE12:  4,
				BucketLE15:  5,
				BucketLEInf: 6,
			}
			assert.Equal(t, expectedCachedResult, actualResult)

			err = createToken(8, sqlStore)
			require.NoError(t, err)

			actualResult, err = uss.GetConcurrentUsersStats(ctx)

			require.NoError(t, err)
			assert.Equal(t, expectedCachedResult, actualResult)
		})
	})
}

func createToken(uId int, sqlStore *sqlstore.SQLStore) error {
	token, err := util.RandomHex(16)
	if err != nil {
		return err
	}
	tokenWithSecret := fmt.Sprintf("%ssecret%d", token, uId)
	hashBytes := sha256.Sum256([]byte(tokenWithSecret))
	hashedToken := hex.EncodeToString(hashBytes[:])

	now := time.Now().Unix()

	userAuthToken := userAuthToken{
		UserID:        int64(uId),
		AuthToken:     hashedToken,
		PrevAuthToken: hashedToken,
		ClientIP:      "192.168.10.11",
		UserAgent:     "Mozilla",
		RotatedAt:     now,
		CreatedAt:     now,
		UpdatedAt:     now,
		SeenAt:        0,
		AuthTokenSeen: false,
	}

	err = sqlStore.WithDbSession(context.Background(), func(dbSession *sqlstore.DBSession) error {
		_, err = dbSession.Insert(&userAuthToken)
		return err
	})

	return nil
}

func createConcurrentTokens(t *testing.T, sqlStore *sqlstore.SQLStore) {
	t.Helper()
	for u := 1; u <= 6; u++ {
		for tkn := 1; tkn <= u*3; tkn++ {
			err := createToken(u, sqlStore)
			require.NoError(t, err)
		}
	}
}

type userAuthToken struct {
	UserID        int64 `xorm:"user_id"`
	AuthToken     string
	PrevAuthToken string
	UserAgent     string
	ClientIP      string `xorm:"client_ip"`
	AuthTokenSeen bool
	SeenAt        int64
	RotatedAt     int64
	CreatedAt     int64
	UpdatedAt     int64
}
