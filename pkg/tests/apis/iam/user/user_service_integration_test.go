package user

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// go test --tags "pro" -timeout 120s -run ^TestIntegrationUserServiceGet$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationUserServiceGet(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type createUserResponse struct {
		ID  int64  `json:"id"`
		UID string `json:"uid"`
	}

	type lookupResponse struct {
		UID   string `json:"uid"`
		Name  string `json:"name"`
		Email string `json:"email"`
		Login string `json:"login"`
	}

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5} {
		t.Run(fmt.Sprintf("dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:      false,
				DisableAnonymous:       true,
				APIServerStorageType:   "unified",
				RBACSingleOrganization: true,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesUsersApi,
					featuremgmt.FlagKubernetesUsersRedirect,
				},
			})

			firstUser := apis.DoRequest(helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: "POST",
				Path:   "/api/admin/users",
				Body:   []byte(`{"name": "First User", "email": "first@example.com", "login": "first-user", "password": "password123"}`),
			}, &createUserResponse{})

			require.NotNil(t, firstUser)
			require.Equal(t, 200, firstUser.Response.StatusCode, "body: %s", string(firstUser.Body))
			require.NotEmpty(t, firstUser.Result.UID)

			secondUser := apis.DoRequest(helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: "POST",
				Path:   "/api/admin/users",
				Body:   []byte(`{"name": "Second User", "email": "second@example.com", "login": "second-user", "password": "password123"}`),
			}, &createUserResponse{})

			require.NotNil(t, secondUser)
			require.Equal(t, 200, secondUser.Response.StatusCode, "body: %s", string(secondUser.Body))
			require.NotEmpty(t, secondUser.Result.UID)

			t.Cleanup(func() {
				apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "DELETE",
					Path:   fmt.Sprintf("/api/admin/users/%d", firstUser.Result.ID),
				}, &struct{}{})
				apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "DELETE",
					Path:   fmt.Sprintf("/api/admin/users/%d", secondUser.Result.ID),
				}, &struct{}{})
			})

			// /api/users/lookup routes through UserK8sService.GetByLogin
			t.Run("should find user by email via GetByLogin", func(t *testing.T) {
				byEmailRsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   "/api/users/lookup?loginOrEmail=first@example.com",
				}, &lookupResponse{})

				require.Equal(t, 200, byEmailRsp.Response.StatusCode, "body: %s", string(byEmailRsp.Body))
				require.Equal(t, firstUser.Result.UID, byEmailRsp.Result.UID)
				require.Equal(t, "First User", byEmailRsp.Result.Name)
				require.Equal(t, "first@example.com", byEmailRsp.Result.Email)
				require.Equal(t, "first-user", byEmailRsp.Result.Login)
			})

			// /api/users/lookup routes through UserK8sService.GetByLogin
			t.Run("should find user by login via GetByLogin", func(t *testing.T) {
				byLoginRsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   "/api/users/lookup?loginOrEmail=second-user",
				}, &lookupResponse{})

				require.Equal(t, 200, byLoginRsp.Response.StatusCode, "body: %s", string(byLoginRsp.Body))
				require.Equal(t, secondUser.Result.UID, byLoginRsp.Result.UID)
				require.Equal(t, "Second User", byLoginRsp.Result.Name)
				require.Equal(t, "second@example.com", byLoginRsp.Result.Email)
				require.Equal(t, "second-user", byLoginRsp.Result.Login)
			})

			t.Run("should return 404 for unknown login", func(t *testing.T) {
				notFoundRsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   "/api/users/lookup?loginOrEmail=nobody",
				}, &lookupResponse{})

				require.Equal(t, 404, notFoundRsp.Response.StatusCode)
			})
		})
	}
}

// go test --tags "pro" -timeout 120s -run ^TestIntegrationUserServiceUpdate$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationUserServiceUpdate(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type createUserResponse struct {
		ID  int64  `json:"id"`
		UID string `json:"uid"`
	}

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5} {
		t.Run(fmt.Sprintf("dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:      false,
				DisableAnonymous:       true,
				APIServerStorageType:   "unified",
				RBACSingleOrganization: true,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesUsersApi,
					featuremgmt.FlagKubernetesUsersRedirect,
				},
			})

			createRsp := apis.DoRequest(helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: "POST",
				Path:   "/api/admin/users",
				Body:   []byte(`{"name": "Original Name", "email": "update-test-user@example.com", "login": "update-test-user", "password": "password123"}`),
			}, &createUserResponse{})

			require.NotNil(t, createRsp)
			require.Equal(t, 200, createRsp.Response.StatusCode, "body: %s", string(createRsp.Body))
			require.NotEmpty(t, createRsp.Result.UID)

			t.Run("should update user via k8s service and verify it using /api/users/:id", func(t *testing.T) {
				require.NotZero(t, createRsp.Result.ID)

				t.Cleanup(func() {
					apis.DoRequest(helper, apis.RequestParams{
						User:   helper.Org1.Admin,
						Method: "DELETE",
						Path:   fmt.Sprintf("/api/admin/users/%d", createRsp.Result.ID),
					}, &struct{}{})
				})

				updateRsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "PUT",
					Path:   fmt.Sprintf("/api/users/%d", createRsp.Result.ID),
					Body:   []byte(`{"name": "Updated Name", "email": "updated@example.com", "login": "updated-user"}`),
				}, &struct{}{})
				require.Equal(t, 200, updateRsp.Response.StatusCode, "body: %s", string(updateRsp.Body))

				type getUserResponse struct {
					ID    int64  `json:"id"`
					Name  string `json:"name"`
					Email string `json:"email"`
					Login string `json:"login"`
				}

				getRsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   fmt.Sprintf("/api/users/%d", createRsp.Result.ID),
				}, &getUserResponse{})

				require.Equal(t, 200, getRsp.Response.StatusCode)
				require.Equal(t, "Updated Name", getRsp.Result.Name)
				require.Equal(t, "updated@example.com", getRsp.Result.Email)
				require.Equal(t, "updated-user", getRsp.Result.Login)
			})
		})
	}
}

// go test --tags "pro" -timeout 120s -run ^TestIntegrationUserService$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationUserService(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type createUserResponse struct {
		ID  int64  `json:"id"`
		UID string `json:"uid"`
	}

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5} {
		t.Run(fmt.Sprintf("dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:      false,
				DisableAnonymous:       true,
				APIServerStorageType:   "unified",
				RBACSingleOrganization: true,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesUsersApi,
					featuremgmt.FlagKubernetesUsersRedirect,
				},
			})

			createRsp := apis.DoRequest(helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: "POST",
				Path:   "/api/admin/users",
				Body:   []byte(`{"name": "K8s Service User", "email": "k8s-service-user@example.com", "login": "k8s-service-user", "password": "password123"}`),
			}, &createUserResponse{})

			require.NotNil(t, createRsp)
			require.Equal(t, 200, createRsp.Response.StatusCode, "body: %s", string(createRsp.Body))
			require.NotEmpty(t, createRsp.Result.UID)

			t.Run("should create user via k8s service and verify it using /api/users/:id", func(t *testing.T) {
				require.NotZero(t, createRsp.Result.ID)

				type getUserResponse struct {
					ID    int64  `json:"id"`
					UID   string `json:"uid"`
					Name  string `json:"name"`
					Email string `json:"email"`
					Login string `json:"login"`
				}

				getRsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   fmt.Sprintf("/api/users/%d", createRsp.Result.ID),
				}, &getUserResponse{})

				require.Equal(t, 200, getRsp.Response.StatusCode)
				require.Equal(t, createRsp.Result.ID, getRsp.Result.ID)
				require.Equal(t, createRsp.Result.UID, getRsp.Result.UID)
				require.Equal(t, "K8s Service User", getRsp.Result.Name)
				require.Equal(t, "k8s-service-user@example.com", getRsp.Result.Email)
				require.Equal(t, "k8s-service-user", getRsp.Result.Login)

				deleteRsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "DELETE",
					Path:   fmt.Sprintf("/api/admin/users/%d", createRsp.Result.ID),
				}, &struct{}{})
				require.Equal(t, 200, deleteRsp.Response.StatusCode)
			})
		})
	}
}

// go test --tags "pro" -timeout 120s -run ^TestIntegrationUserServiceDelete$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationUserServiceDelete(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type createUserResponse struct {
		ID  int64  `json:"id"`
		UID string `json:"uid"`
	}

	type getUserResponse struct {
		ID    int64  `json:"id"`
		UID   string `json:"uid"`
		Name  string `json:"name"`
		Email string `json:"email"`
		Login string `json:"login"`
	}

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5} {
		t.Run(fmt.Sprintf("dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:      false,
				DisableAnonymous:       true,
				APIServerStorageType:   "unified",
				RBACSingleOrganization: true,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesUsersApi,
					featuremgmt.FlagKubernetesUsersRedirect,
				},
			})

			createRsp := apis.DoRequest(helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: "POST",
				Path:   "/api/admin/users",
				Body:   []byte(`{"name": "Delete Test User", "email": "delete-test@example.com", "login": "delete-test-user", "password": "password123"}`),
			}, &createUserResponse{})
			require.Equal(t, 200, createRsp.Response.StatusCode, "body: %s", string(createRsp.Body))
			require.NotZero(t, createRsp.Result.ID)
			require.NotEmpty(t, createRsp.Result.UID)

			t.Run("user exists after creation", func(t *testing.T) {
				getRsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   fmt.Sprintf("/api/users/%d", createRsp.Result.ID),
				}, &getUserResponse{})
				require.Equal(t, 200, getRsp.Response.StatusCode, "body: %s", string(getRsp.Body))
				require.Equal(t, createRsp.Result.ID, getRsp.Result.ID)
				require.Equal(t, createRsp.Result.UID, getRsp.Result.UID)
			})

			t.Run("delete succeeds", func(t *testing.T) {
				deleteRsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "DELETE",
					Path:   fmt.Sprintf("/api/admin/users/%d", createRsp.Result.ID),
				}, &struct{}{})
				require.Equal(t, 200, deleteRsp.Response.StatusCode, "body: %s", string(deleteRsp.Body))
			})

			t.Run("user is gone after deletion", func(t *testing.T) {
				getRsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   fmt.Sprintf("/api/users/%d", createRsp.Result.ID),
				}, &getUserResponse{})
				require.Equal(t, 404, getRsp.Response.StatusCode, "body: %s", string(getRsp.Body))
			})
		})
	}
}

// go test --tags "pro" -timeout 120s -run ^TestIntegrationUserServiceSearch$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationUserServiceSearch(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type createUserResponse struct {
		ID  int64  `json:"id"`
		UID string `json:"uid"`
	}

	type searchUserHit struct {
		UID   string `json:"uid"`
		Name  string `json:"name"`
		Login string `json:"login"`
		Email string `json:"email"`
	}

	type searchUsersResponse struct {
		TotalCount int64           `json:"totalCount"`
		Users      []searchUserHit `json:"users"`
		Page       int             `json:"page"`
		PerPage    int             `json:"perPage"`
	}

	for _, mode := range []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode2, rest.Mode3, rest.Mode4, rest.Mode5} {
		t.Run(fmt.Sprintf("dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:      false,
				DisableAnonymous:       true,
				APIServerStorageType:   "unified",
				RBACSingleOrganization: true,
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"users.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesUsersApi,
					featuremgmt.FlagKubernetesUsersRedirect,
				},
			})

			alphaUser := apis.DoRequest(helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: "POST",
				Path:   "/api/admin/users",
				Body:   []byte(`{"name": "Alpha User", "email": "alpha@example.com", "login": "alpha-user", "password": "password123"}`),
			}, &createUserResponse{})
			require.Equal(t, 200, alphaUser.Response.StatusCode, "body: %s", string(alphaUser.Body))
			require.NotEmpty(t, alphaUser.Result.UID)
			require.NotZero(t, alphaUser.Result.ID)

			betaUser := apis.DoRequest(helper, apis.RequestParams{
				User:   helper.Org1.Admin,
				Method: "POST",
				Path:   "/api/admin/users",
				Body:   []byte(`{"name": "Beta User", "email": "beta@example.com", "login": "beta-user", "password": "password123"}`),
			}, &createUserResponse{})
			require.Equal(t, 200, betaUser.Response.StatusCode, "body: %s", string(betaUser.Body))
			require.NotEmpty(t, betaUser.Result.UID)
			require.NotZero(t, betaUser.Result.ID)

			// Wait for the search index to be populated.
			time.Sleep(2 * time.Second)

			t.Cleanup(func() {
				apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "DELETE",
					Path:   fmt.Sprintf("/api/admin/users/%d", alphaUser.Result.ID),
				}, &struct{}{})
				apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "DELETE",
					Path:   fmt.Sprintf("/api/admin/users/%d", betaUser.Result.ID),
				}, &struct{}{})
			})

			t.Run("should return users with correct fields", func(t *testing.T) {
				rsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   "/api/users/search?query=alpha",
				}, &searchUsersResponse{})
				require.Equal(t, 200, rsp.Response.StatusCode, "body: %s", string(rsp.Body))
				require.NotEmpty(t, rsp.Result.Users)

				var hit *searchUserHit
				for i := range rsp.Result.Users {
					if rsp.Result.Users[i].Login == "alpha-user" {
						hit = &rsp.Result.Users[i]
						break
					}
				}
				require.NotNil(t, hit, "alpha-user not found in search results")
				require.Equal(t, alphaUser.Result.UID, hit.UID)
				require.Equal(t, "Alpha User", hit.Name)
				require.Equal(t, "alpha@example.com", hit.Email)
			})

			t.Run("should filter results by query", func(t *testing.T) {
				rsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   "/api/users/search?query=beta",
				}, &searchUsersResponse{})
				require.Equal(t, 200, rsp.Response.StatusCode, "body: %s", string(rsp.Body))

				foundBeta := false
				for _, u := range rsp.Result.Users {
					require.NotEqual(t, "alpha-user", u.Login, "alpha-user should not appear in beta search")
					if u.Login == "beta-user" {
						foundBeta = true
					}
				}
				require.True(t, foundBeta, "beta-user should be in search results")
			})

			t.Run("should return all users when no query given", func(t *testing.T) {
				rsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   "/api/users/search",
				}, &searchUsersResponse{})
				require.Equal(t, 200, rsp.Response.StatusCode, "body: %s", string(rsp.Body))
				require.GreaterOrEqual(t, rsp.Result.TotalCount, int64(2))

				logins := make([]string, 0, len(rsp.Result.Users))
				for _, u := range rsp.Result.Users {
					logins = append(logins, u.Login)
				}
				require.Contains(t, logins, "alpha-user")
				require.Contains(t, logins, "beta-user")
			})

			t.Run("should respect perpage and page parameters", func(t *testing.T) {
				rsp := apis.DoRequest(helper, apis.RequestParams{
					User:   helper.Org1.Admin,
					Method: "GET",
					Path:   "/api/users/search?perpage=1&page=1",
				}, &searchUsersResponse{})
				require.Equal(t, 200, rsp.Response.StatusCode, "body: %s", string(rsp.Body))
				require.Len(t, rsp.Result.Users, 1)
				require.Equal(t, 1, rsp.Result.Page)
				require.Equal(t, 1, rsp.Result.PerPage)
				require.GreaterOrEqual(t, rsp.Result.TotalCount, int64(2))

				allLogins := []string{rsp.Result.Users[0].Login}
				for page := 2; page <= int(rsp.Result.TotalCount); page++ {
					pageRsp := apis.DoRequest(helper, apis.RequestParams{
						User:   helper.Org1.Admin,
						Method: "GET",
						Path:   fmt.Sprintf("/api/users/search?perpage=1&page=%d", page),
					}, &searchUsersResponse{})
					require.Equal(t, 200, pageRsp.Response.StatusCode, "body: %s", string(pageRsp.Body))
					if len(pageRsp.Result.Users) == 0 {
						break
					}
					allLogins = append(allLogins, pageRsp.Result.Users[0].Login)
				}
				require.Contains(t, allLogins, "alpha-user")
				require.Contains(t, allLogins, "beta-user")
			})

			for _, tc := range []struct {
				sortParam  string
				alphaFirst bool
			}{
				{"login-asc", true},
				{"login-desc", false},
				{"name-asc", true},
				{"name-desc", false},
				{"email-asc", true},
				{"email-desc", false},
			} {
				tc := tc
				t.Run(fmt.Sprintf("should sort users by %s", tc.sortParam), func(t *testing.T) {
					rsp := apis.DoRequest(helper, apis.RequestParams{
						User:   helper.Org1.Admin,
						Method: "GET",
						Path:   fmt.Sprintf("/api/users/search?sort=%s", tc.sortParam),
					}, &searchUsersResponse{})
					require.Equal(t, 200, rsp.Response.StatusCode, "body: %s", string(rsp.Body))

					alphaIdx, betaIdx := -1, -1
					for i, u := range rsp.Result.Users {
						switch u.Login {
						case "alpha-user":
							alphaIdx = i
						case "beta-user":
							betaIdx = i
						}
					}
					require.NotEqual(t, -1, alphaIdx, "alpha-user not found in results")
					require.NotEqual(t, -1, betaIdx, "beta-user not found in results")
					if tc.alphaFirst {
						require.Less(t, alphaIdx, betaIdx, "alpha-user should come before beta-user")
					} else {
						require.Greater(t, alphaIdx, betaIdx, "beta-user should come before alpha-user")
					}
				})
			}
		})
	}
}
