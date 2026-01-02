package identity

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationUserSearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("DualWriterMode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesAuthnMutation,
				},
				UnifiedStorageEnableSearch: true,
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			setupUsers(t, helper)

			t.Run("search by title", func(t *testing.T) {
				res := searchUsers(t, helper, "Alice")
				require.Len(t, res.Hits, 1)
				require.Equal(t, "TestUser Alice", res.Hits[0].Title)
			})

			t.Run("search by login", func(t *testing.T) {
				res := searchUsers(t, helper, "bob")
				require.Len(t, res.Hits, 1)
				require.Equal(t, "bob", res.Hits[0].Login)
			})

			t.Run("search by email", func(t *testing.T) {
				res := searchUsers(t, helper, "charlie@example.com")
				require.Len(t, res.Hits, 1)
				require.Equal(t, "charlie@example.com", res.Hits[0].Email)
			})
		})
	}
}

func TestIntegrationUserSearch_WithSorting(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("DualWriterMode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesAuthnMutation,
				},
				UnifiedStorageEnableSearch: true,
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			setupUsers(t, helper)

			tests := []struct {
				field     string
				extractor func(iamv0.UserHit) string
				expected  []string
			}{
				{
					field:     "title",
					extractor: func(h iamv0.UserHit) string { return h.Title },
					expected:  []string{"TestUser Alice", "TestUser Bob", "TestUser Charlie", "TestUser Editor", "TestUser Viewer"},
				},
				{
					field:     "login",
					extractor: func(h iamv0.UserHit) string { return h.Login },
					expected:  []string{"alice", "bob", "charlie", "testuser-editor", "testuser-viewer"},
				},
				{
					field:     "email",
					extractor: func(h iamv0.UserHit) string { return h.Email },
					expected:  []string{"alice@example.com", "bob@example.com", "charlie@example.com", "testuser-editor@example.com", "testuser-viewer@example.com"},
				},
			}

			for _, tc := range tests {
				t.Run("sort by "+tc.field, func(t *testing.T) {
					// ASC
					res := searchUsersWithSort(t, helper, "TestUser", tc.field)
					require.GreaterOrEqual(t, len(res.Hits), 5)
					verifyOrder(t, res.Hits, tc.expected, tc.extractor)

					// DESC
					res = searchUsersWithSort(t, helper, "TestUser", "-"+tc.field)
					require.GreaterOrEqual(t, len(res.Hits), 5)

					// Reverse expected
					reversed := make([]string, len(tc.expected))
					copy(reversed, tc.expected)
					sort.Sort(sort.Reverse(sort.StringSlice(reversed)))
					verifyOrder(t, res.Hits, reversed, tc.extractor)
				})
			}

			t.Run("sort by lastSeenAt", func(t *testing.T) {
				if mode >= rest.Mode3 {
					t.Skip("Skipping lastSeenAt sort test for Mode >= 3: API does not persist status.lastSeenAt")
				}
				// Populate lastSeenAt
				// Alice: 30 minutes ago
				// Bob: 1 minute ago
				// Charlie: 2 hours ago
				// Editor: 40 minutes ago
				// Viewer: 1h 30 mins ago
				now := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)
				updateLastSeenAt(t, helper, "alice", now.Add(-30*time.Minute), mode)
				updateLastSeenAt(t, helper, "bob", now.Add(-1*time.Minute), mode)
				updateLastSeenAt(t, helper, "charlie", now.Add(-2*time.Hour), mode)
				updateLastSeenAt(t, helper, "testuser-editor", now.Add(-40*time.Minute), mode)
				updateLastSeenAt(t, helper, "testuser-viewer", now.Add(-90*time.Minute), mode)

				// lastSeenAt ASC means oldest date first to match legacy behavior
				res := searchUsersWithSort(t, helper, "TestUser", "lastSeenAt")
				require.GreaterOrEqual(t, len(res.Hits), 5)
				verifyOrder(t, res.Hits, []string{"charlie", "testuser-viewer", "testuser-editor", "alice", "bob"}, func(h iamv0.UserHit) string { return h.Login })

				res = searchUsersWithSort(t, helper, "TestUser", "-lastSeenAt")
				require.GreaterOrEqual(t, len(res.Hits), 5)
				verifyOrder(t, res.Hits, []string{"bob", "alice", "testuser-editor", "testuser-viewer", "charlie"}, func(h iamv0.UserHit) string { return h.Login })
			})
		})
	}
}

func TestIntegrationUserSearch_SortCompareLegacy(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode2}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("DualWriterMode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesAuthnMutation,
				},
				UnifiedStorageEnableSearch: true,
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			setupUsers(t, helper)

			// Populate lastSeenAt for sorting comparison
			now := time.Date(2025, 1, 1, 12, 0, 0, 0, time.UTC)
			updateLastSeenAt(t, helper, "alice", now.Add(-30*time.Minute), mode)
			updateLastSeenAt(t, helper, "bob", now.Add(-1*time.Minute), mode)
			updateLastSeenAt(t, helper, "charlie", now.Add(-2*time.Hour), mode)
			updateLastSeenAt(t, helper, "testuser-editor", now.Add(-40*time.Minute), mode)
			updateLastSeenAt(t, helper, "testuser-viewer", now.Add(-90*time.Minute), mode)

			fields := []string{"login", "email", "name", "lastSeenAt"}
			for _, field := range fields {
				for _, order := range []string{"asc", "desc"} {
					t.Run(fmt.Sprintf("compare %s %s", field, order), func(t *testing.T) {
						// Legacy API uses "name" for Name/Title, "login" for Login, "email" for Email.
						// "lastSeenAt" maps to "lastSeenAtAge" in legacy.
						legacySort := field
						if field == "lastSeenAt" {
							legacySort = "lastSeenAtAge"
						}
						legacySort += "-" + order

						newSort := field
						if order == "desc" {
							newSort = "-" + field
						}

						legacyRes := searchUsersLegacy(t, helper, "TestUser", legacySort)
						newRes := searchUsersWithSort(t, helper, "TestUser", newSort)

						require.Equal(t, len(legacyRes), len(newRes.Hits))
						for i := range legacyRes {
							require.Equal(t, legacyRes[i].Login, newRes.Hits[i].Login, "Mismatch at index %d for sort %s", i, newSort)
						}
					})
				}
			}
		})
	}
}

func TestIntegrationUserSearch_Paging(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("DualWriterMode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesAuthnMutation,
				},
				UnifiedStorageEnableSearch: true,
			})

			t.Cleanup(func() {
				helper.Shutdown()
			})

			setupUsers(t, helper)

			t.Run("paging with page and limit", func(t *testing.T) {
				// There are 5 users matching "TestUser"
				query := "TestUser"

				// Page 1, Limit 2
				res1 := searchUsersWithPaging(t, helper, query, 1, 2)
				require.Equal(t, int64(5), res1.TotalHits)
				require.Len(t, res1.Hits, 2)

				// Page 2, Limit 2
				res2 := searchUsersWithPaging(t, helper, query, 2, 2)
				require.Equal(t, int64(5), res2.TotalHits)
				require.Len(t, res2.Hits, 2)

				// Page 3, Limit 2
				res3 := searchUsersWithPaging(t, helper, query, 3, 2)
				require.Equal(t, int64(5), res3.TotalHits)
				require.Len(t, res3.Hits, 1)

				seen := make(map[string]bool)
				for _, h := range res1.Hits {
					seen[h.Login] = true
				}
				for _, h := range res2.Hits {
					require.False(t, seen[h.Login], "User %s seen in page 1 and 2", h.Login)
					seen[h.Login] = true
				}
				for _, h := range res3.Hits {
					require.False(t, seen[h.Login], "User %s seen in previous pages", h.Login)
					seen[h.Login] = true
				}
				require.Len(t, seen, 5)
			})

			t.Run("paging with offset and limit", func(t *testing.T) {
				// There are 5 users matching "TestUser"
				query := "TestUser"

				// Offset 0, Limit 2 (equivalent to Page 1)
				res1 := searchUsersWithOffset(t, helper, query, 0, 2)
				require.Equal(t, int64(5), res1.TotalHits)
				require.Len(t, res1.Hits, 2)

				// Offset 2, Limit 2 (equivalent to Page 2)
				res2 := searchUsersWithOffset(t, helper, query, 2, 2)
				require.Equal(t, int64(5), res2.TotalHits)
				require.Len(t, res2.Hits, 2)

				// Offset 4, Limit 2 (equivalent to Page 3)
				res3 := searchUsersWithOffset(t, helper, query, 4, 2)
				require.Equal(t, int64(5), res3.TotalHits)
				require.Len(t, res3.Hits, 1)

				// Verify uniqueness
				seen := make(map[string]bool)
				for _, h := range res1.Hits {
					seen[h.Login] = true
				}
				for _, h := range res2.Hits {
					require.False(t, seen[h.Login], "User %s seen in offset 0 and 2", h.Login)
					seen[h.Login] = true
				}
				for _, h := range res3.Hits {
					require.False(t, seen[h.Login], "User %s seen in previous offsets", h.Login)
					seen[h.Login] = true
				}
				require.Len(t, seen, 5)
			})
		})
	}
}

func setupUsers(t *testing.T, helper *apis.K8sTestHelper) {
	ctx := context.Background()
	userClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
		GVR:       gvrUsers,
	})

	users := []iamv0.User{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name: "testuser-editor",
			},
			Spec: iamv0.UserSpec{
				Title: "TestUser Editor",
				Login: "testuser-editor",
				Email: "testuser-editor@example.com",
				Role:  "Editor",
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name: "testuser-viewer",
			},
			Spec: iamv0.UserSpec{
				Title: "TestUser Viewer",
				Login: "testuser-viewer",
				Email: "testuser-viewer@example.com",
				Role:  "Viewer",
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name: "alice",
			},
			Spec: iamv0.UserSpec{
				Title: "TestUser Alice",
				Login: "alice",
				Email: "alice@example.com",
				Role:  "Viewer",
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name: "bob",
			},
			Spec: iamv0.UserSpec{
				Title: "TestUser Bob",
				Login: "bob",
				Email: "bob@example.com",
				Role:  "Viewer",
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name: "charlie",
			},
			Spec: iamv0.UserSpec{
				Title: "TestUser Charlie",
				Login: "charlie",
				Email: "charlie@example.com",
				Role:  "Viewer",
			},
		},
	}

	for _, u := range users {
		uMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&u)
		require.NoError(t, err)
		_, err = userClient.Resource.Create(ctx, &unstructured.Unstructured{Object: uMap}, metav1.CreateOptions{})
		require.NoError(t, err)
	}

	// Wait for indexing
	time.Sleep(2 * time.Second)
}

func searchUsers(t *testing.T, helper *apis.K8sTestHelper, query string) *iamv0.GetSearchUsers {
	return searchUsersWithSort(t, helper, query, "")
}

func searchUsersWithSort(t *testing.T, helper *apis.K8sTestHelper, query string, sort string) *iamv0.GetSearchUsers {
	q := url.Values{}
	q.Set("query", query)
	if sort != "" {
		q.Set("sort", sort)
	}
	q.Set("limit", "100")

	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/searchUsers?%s", q.Encode())

	res := &iamv0.GetSearchUsers{}
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: "GET",
		Path:   path,
	}, res)

	require.Equal(t, 200, rsp.Response.StatusCode)
	return res
}

func searchUsersWithPaging(t *testing.T, helper *apis.K8sTestHelper, query string, page, limit int) *iamv0.GetSearchUsers {
	q := url.Values{}
	q.Set("query", query)
	q.Set("page", fmt.Sprintf("%d", page))
	q.Set("limit", fmt.Sprintf("%d", limit))
	// Sort by login to ensure deterministic paging
	q.Set("sort", "login")

	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/searchUsers?%s", q.Encode())

	res := &iamv0.GetSearchUsers{}
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: "GET",
		Path:   path,
	}, res)

	require.Equal(t, 200, rsp.Response.StatusCode)
	return res
}

func searchUsersWithOffset(t *testing.T, helper *apis.K8sTestHelper, query string, offset, limit int) *iamv0.GetSearchUsers {
	q := url.Values{}
	q.Set("query", query)
	q.Set("offset", fmt.Sprintf("%d", offset))
	q.Set("limit", fmt.Sprintf("%d", limit))
	// Sort by login to ensure deterministic paging
	q.Set("sort", "login")

	path := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/default/searchUsers?%s", q.Encode())

	res := &iamv0.GetSearchUsers{}
	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: "GET",
		Path:   path,
	}, res)

	require.Equal(t, 200, rsp.Response.StatusCode)
	return res
}

type LegacyUserSearchHit struct {
	UserId int64  `json:"userId"`
	Name   string `json:"name"`
	Login  string `json:"login"`
	Email  string `json:"email"`
}

func searchUsersLegacy(t *testing.T, helper *apis.K8sTestHelper, query string, sort string) []LegacyUserSearchHit {
	q := url.Values{}
	q.Set("query", query)

	if sort != "" {
		q.Set("sort", sort)
	}
	q.Set("perpage", "100")
	q.Set("page", "1")

	path := fmt.Sprintf("/api/org/users/search?%s", q.Encode())

	var res struct {
		OrgUsers []LegacyUserSearchHit `json:"orgUsers"`
	}

	rsp := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: "GET",
		Path:   path,
	}, &res)

	require.Equal(t, 200, rsp.Response.StatusCode)
	return res.OrgUsers
}

// verifyOrder checks that the extracted values from hits are in the expected order.
// It filters hits to only include those with expected values, because search returns more results than just the test users.
// Like other users in the system that have been created by the test framework.
func verifyOrder(t *testing.T, hits []iamv0.UserHit, expectedValues []string, extractor func(iamv0.UserHit) string) {
	// Filter hits to only include expected values
	var actualValues []string
	expectedSet := make(map[string]bool)
	for _, v := range expectedValues {
		expectedSet[v] = true
	}

	for _, h := range hits {
		val := extractor(h)
		if expectedSet[val] {
			actualValues = append(actualValues, val)
		}
	}

	require.Equal(t, expectedValues, actualValues)
}

func updateLastSeenAt(t *testing.T, helper *apis.K8sTestHelper, login string, lastSeen time.Time, mode rest.DualWriterMode) {
	if mode < rest.Mode3 {
		err := helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.Table("user").Where("login = ?", login).Update(map[string]interface{}{
				"last_seen_at": lastSeen,
			})
			return err
		})
		require.NoError(t, err)
	}

	// Use the new APIs to update the user resource status in Mode3+
	if mode >= rest.Mode3 {
		ctx := context.Background()
		userClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrUsers,
		})

		u, err := userClient.Resource.Get(ctx, login, metav1.GetOptions{})
		require.NoError(t, err)

		err = unstructured.SetNestedField(u.Object, lastSeen.Unix(), "status", "lastSeenAt")
		require.NoError(t, err)

		_, err = userClient.Resource.Update(ctx, u, metav1.UpdateOptions{})
		require.NoError(t, err)
	}
}
