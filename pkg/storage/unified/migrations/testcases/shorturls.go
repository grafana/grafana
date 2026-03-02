package testcases

import (
	"context"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/shorturls/shorturlimpl"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// shortURLsTestCase tests the "shorturls" ResourceMigration
type shortURLsTestCase struct {
	shortURLUIDs []string
}

// NewShortURLsTestCase creates a test case for the shorturls migrator
func NewShortURLsTestCase() ResourceMigratorTestCase {
	return &shortURLsTestCase{
		shortURLUIDs: []string{},
	}
}

func (tc *shortURLsTestCase) Name() string {
	return "shorturls"
}

func (tc *shortURLsTestCase) FeatureToggles() []string {
	return []string{featuremgmt.FlagKubernetesShortURLs}
}

func (tc *shortURLsTestCase) Resources() []schema.GroupVersionResource {
	return []schema.GroupVersionResource{
		{
			Group:    "shorturl.grafana.app",
			Version:  "v1beta1",
			Resource: "shorturls",
		},
	}
}

func (tc *shortURLsTestCase) Setup(t *testing.T, helper *apis.K8sTestHelper) {
	t.Helper()

	env := helper.GetEnv()
	shortURLSvc := shorturlimpl.ProvideService(env.SQLStore)
	user := helper.Org1.Admin.Identity

	// Create short URL pointing to a dashboard
	uid1 := createTestShortURL(t, shortURLSvc, user, "d/abc123/my-dashboard")
	tc.shortURLUIDs = append(tc.shortURLUIDs, uid1)

	// Create short URL pointing to an explore path
	uid2 := createTestShortURL(t, shortURLSvc, user, "explore?orgId=1&left=%5B%22now-1h%22,%22now%22%5D")
	tc.shortURLUIDs = append(tc.shortURLUIDs, uid2)

	// Create short URL pointing to an alerting path
	uid3 := createTestShortURL(t, shortURLSvc, user, "alerting/list?search=cpu&state=firing")
	tc.shortURLUIDs = append(tc.shortURLUIDs, uid3)
}

func (tc *shortURLsTestCase) Verify(t *testing.T, helper *apis.K8sTestHelper, shouldExist bool) {
	t.Helper()

	expectedCount := 0
	if shouldExist {
		expectedCount = len(tc.shortURLUIDs)
	}

	orgID := helper.Org1.OrgID
	namespace := authlib.OrgNamespaceFormatter(orgID)

	shortURLCli := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: namespace,
		GVR: schema.GroupVersionResource{
			Group:    "shorturl.grafana.app",
			Version:  "v1beta1",
			Resource: "shorturls",
		},
	})

	verifyResourceCount(t, shortURLCli, expectedCount)
	for _, uid := range tc.shortURLUIDs {
		verifyResource(t, shortURLCli, uid, shouldExist)
	}
}

func createTestShortURL(t *testing.T, svc *shorturlimpl.ShortURLService, user identity.Requester, path string) string {
	t.Helper()

	cmd := &dtos.CreateShortURLCmd{
		Path: path,
	}

	result, err := svc.CreateShortURL(context.Background(), user, cmd)
	require.NoError(t, err)
	require.NotNil(t, result)
	require.NotEmpty(t, result.Uid)

	return result.Uid
}
