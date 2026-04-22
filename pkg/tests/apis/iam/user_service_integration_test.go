package identity

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

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
				if firstUser.Result.ID != 0 {
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
				} else {
					ctx := context.Background()
					userClient := helper.GetResourceClient(apis.ResourceClientArgs{
						User:      helper.Org1.Admin,
						Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
						GVR:       gvrUsers,
					})
					_ = userClient.Resource.Delete(ctx, firstUser.Result.UID, metav1.DeleteOptions{})
					_ = userClient.Resource.Delete(ctx, secondUser.Result.UID, metav1.DeleteOptions{})
				}
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

			if mode < rest.Mode4 {
				// Modes 0–3 write to the legacy SQL database, so the legacy API can verify the updated user.
				// UserK8sService.Update is exercised via PUT /api/users/{id} → Service.Update →
				// k8sService.Update (because FlagKubernetesUsersRedirect is enabled).
				t.Run("should update user via k8s service and verify it using the legacy API", func(t *testing.T) {
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
			} else {
				// Modes 4–5 use the kubernetes API as the primary (or only) storage. Since the
				// internal ID is not populated for these modes, the update is applied directly
				// via the k8s client and verified with a subsequent Get.
				t.Run("should update user via k8s service and verify it using the kubernetes API", func(t *testing.T) {
					ctx := context.Background()

					userClient := helper.GetResourceClient(apis.ResourceClientArgs{
						User:      helper.Org1.Admin,
						Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
						GVR:       gvrUsers,
					})

					t.Cleanup(func() {
						_ = userClient.Resource.Delete(ctx, createRsp.Result.UID, metav1.DeleteOptions{})
					})

					patchBody := []byte(`{"spec":{"title":"Updated K8s Name","email":"updated-k8s@example.com","login":"updated-k8s-user"}}`)
					_, err := userClient.Resource.Patch(ctx, createRsp.Result.UID, types.MergePatchType, patchBody, metav1.PatchOptions{})
					require.NoError(t, err)

					fetched, err := userClient.Resource.Get(ctx, createRsp.Result.UID, metav1.GetOptions{})
					require.NoError(t, err)

					userSpec := fetched.Object["spec"].(map[string]interface{})
					require.Equal(t, "Updated K8s Name", userSpec["title"])
					require.Equal(t, "updated-k8s@example.com", userSpec["email"])
					require.Equal(t, "updated-k8s-user", userSpec["login"])
				})
			}
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

			if mode <= rest.Mode3 {
				// Modes 0–3 write to the legacy SQL database, so the legacy API can verify the user.
				// UserID is only populated in these modes because SetDeprecatedInternalID is only set
				// by the LegacyStore on the returned k8s object.
				t.Run("should create user via k8s service and verify it using the legacy API", func(t *testing.T) {
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
			} else {
				// Modes 4–5 use the kubernetes API as the primary (or only) storage, so the k8s
				// client is used for verification and cleanup.
				t.Run("should create user via k8s service and verify it using the kubernetes API", func(t *testing.T) {
					ctx := context.Background()

					userClient := helper.GetResourceClient(apis.ResourceClientArgs{
						User:      helper.Org1.Admin,
						Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
						GVR:       gvrUsers,
					})

					fetched, err := userClient.Resource.Get(ctx, createRsp.Result.UID, metav1.GetOptions{})
					require.NoError(t, err)

					userSpec := fetched.Object["spec"].(map[string]interface{})
					require.Equal(t, "K8s Service User", userSpec["title"])
					require.Equal(t, "k8s-service-user@example.com", userSpec["email"])
					require.Equal(t, "k8s-service-user", userSpec["login"])

					err = userClient.Resource.Delete(ctx, createRsp.Result.UID, metav1.DeleteOptions{})
					require.NoError(t, err)
				})
			}
		})
	}
}
