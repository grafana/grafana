package statscollector

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/stats/statsimpl"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// run tests with cleanup
func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationConcurrentUsersMetrics(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore, cfg := db.InitTestDBWithCfg(t)
	statsService := statsimpl.ProvideService(&setting.Cfg{}, sqlStore, &dashboards.FakeDashboardService{}, &foldertest.FakeService{}, &orgtest.FakeOrgService{}, featuremgmt.WithFeatures())
	s := createService(t, cfg, sqlStore, statsService)

	createConcurrentTokens(t, sqlStore)

	stats, err := s.collectConcurrentUsers(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int32(1), stats["stats.auth_token_per_user_le_3"])
	assert.Equal(t, int32(2), stats["stats.auth_token_per_user_le_6"])
	assert.Equal(t, int32(3), stats["stats.auth_token_per_user_le_9"])
	assert.Equal(t, int32(4), stats["stats.auth_token_per_user_le_12"])
	assert.Equal(t, int32(5), stats["stats.auth_token_per_user_le_15"])
	assert.Equal(t, int32(6), stats["stats.auth_token_per_user_le_inf"])
}

func TestIntegrationConcurrentUsersStats(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	sqlStore, cfg := db.InitTestDBWithCfg(t)
	statsService := statsimpl.ProvideService(&setting.Cfg{}, sqlStore, &dashboards.FakeDashboardService{}, &foldertest.FakeService{}, &orgtest.FakeOrgService{}, featuremgmt.WithFeatures())
	s := createService(t, cfg, sqlStore, statsService)

	createConcurrentTokens(t, sqlStore)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(func() {
		cancel()
	})

	actualResult, err := s.concurrentUsers(ctx)
	require.NoError(t, err)

	expectedResult := &concurrentUsersStats{
		BucketLE3:   1,
		BucketLE6:   2,
		BucketLE9:   3,
		BucketLE12:  4,
		BucketLE15:  5,
		BucketLEInf: 6,
	}
	assert.Equal(t, expectedResult, actualResult)

	createToken(t, 8, sqlStore)
	require.NoError(t, err)

	// Cached, new token is not reflected yet.
	actualResult, err = s.concurrentUsers(ctx)
	require.NoError(t, err)
	assert.Equal(t, expectedResult, actualResult)

	// Bust cache
	s.concurrentUserStatsCache = memoConcurrentUserStats{}

	expectedResult = &concurrentUsersStats{
		BucketLE3:   2,
		BucketLE6:   3,
		BucketLE9:   4,
		BucketLE12:  5,
		BucketLE15:  6,
		BucketLEInf: 7,
	}
	actualResult, err = s.concurrentUsers(ctx)
	require.NoError(t, err)
	assert.Equal(t, expectedResult, actualResult)
}

func createConcurrentTokens(t *testing.T, sqlStore db.DB) {
	t.Helper()
	for u := 1; u <= 6; u++ {
		for tkn := 1; tkn <= u*3; tkn++ {
			createToken(t, u, sqlStore)
		}
	}
}

func createToken(t *testing.T, uID int, sqlStore db.DB) {
	t.Helper()
	token, err := util.RandomHex(16)
	require.NoError(t, err)

	tokenWithSecret := fmt.Sprintf("%ssecret%d", token, uID)
	hashBytes := sha256.Sum256([]byte(tokenWithSecret))
	hashedToken := hex.EncodeToString(hashBytes[:])

	now := time.Now().Unix()

	userAuthToken := userAuthToken{
		UserID:        int64(uID),
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

	err = sqlStore.WithDbSession(context.Background(), func(dbSession *db.Session) error {
		_, err = dbSession.Insert(&userAuthToken)
		return err
	})
	require.NoError(t, err)
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
