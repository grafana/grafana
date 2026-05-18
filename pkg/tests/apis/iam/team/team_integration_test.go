package team

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// go test --tags "pro" -timeout 120s -run ^TestIntegrationTeams$ github.com/grafana/grafana/pkg/tests/apis/iam -count=1
func TestIntegrationTeams(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	modes := []rest.DualWriterMode{rest.Mode0, rest.Mode1, rest.Mode5}
	for _, mode := range modes {
		t.Run(fmt.Sprintf("Team CRUD operations with dual writer mode %d", mode), func(t *testing.T) {
			helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
				AppModeProduction:    false,
				DisableAnonymous:     true,
				APIServerStorageType: "unified",
				UnifiedStorageConfig: map[string]setting.UnifiedStorageConfig{
					"teams.iam.grafana.app": {
						DualWriterMode: mode,
					},
				},
				EnableFeatureToggles: []string{
					featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
					featuremgmt.FlagKubernetesTeamsApi,
				},
			})

			doTeamCRUDTestsUsingTheNewAPIs(t, helper)
			doTeamSpecMembersTests(t, helper)
			doTeamSpecExternalGroupsOSSTests(t, helper)

			if mode < 3 {
				doTeamCRUDTestsUsingTheLegacyAPIs(t, helper, mode)
			}
		})
	}
}

func doTeamCRUDTestsUsingTheNewAPIs(t *testing.T, helper *apis.K8sTestHelper) {
	t.Run("should create/get/update/delete team using the new APIs as a GrafanaAdmin", func(t *testing.T) {
		ctx := context.Background()

		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		// Create the team
		created, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Team 1", createdSpec["title"])
		require.Equal(t, "testteam1@example123.com", createdSpec["email"])
		require.Equal(t, false, createdSpec["provisioned"])

		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)

		// Get the team
		fetched, err := teamClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Team 1", fetchedSpec["title"])
		require.Equal(t, "testteam1@example123.com", fetchedSpec["email"])
		require.Equal(t, false, fetchedSpec["provisioned"])

		require.Equal(t, createdUID, fetched.GetName())
		require.Equal(t, "default", fetched.GetNamespace())

		// Update the team
		updatedTeam, err := teamClient.Resource.Update(ctx, helper.LoadYAMLOrJSONFile("../testdata/team-test-update-v0.yaml"), metav1.UpdateOptions{})
		require.NoError(t, err)
		require.NotNil(t, updatedTeam)

		updatedSpec := updatedTeam.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Team 2", updatedSpec["title"])
		require.Equal(t, "testteam2@example123.com", updatedSpec["email"])
		require.Equal(t, false, updatedSpec["provisioned"])

		verifiedTeam, err := teamClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, verifiedTeam)

		verifiedSpec := verifiedTeam.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Team 2", verifiedSpec["title"])
		require.Equal(t, "testteam2@example123.com", verifiedSpec["email"])
		require.Equal(t, false, verifiedSpec["provisioned"])

		// Delete the team
		err = teamClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		require.NoError(t, err)

		_, err = teamClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, "Failure", statusErr.ErrStatus.Status)
		require.Contains(t, statusErr.ErrStatus.Message, "not found")
	})

	t.Run("should not be able to create team when using a user with insufficient permissions", func(t *testing.T) {
		for _, user := range []apis.User{
			helper.Org1.Editor,
			helper.Org1.Viewer,
		} {
			t.Run(fmt.Sprintf("with basic role_%s", user.Identity.GetOrgRole()), func(t *testing.T) {
				ctx := context.Background()
				teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
					User:      user,
					Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
					GVR:       gvrTeams,
				})

				_, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
				require.Error(t, err)
				var statusErr *errors.StatusError
				require.ErrorAs(t, err, &statusErr)
				require.Equal(t, int32(403), statusErr.ErrStatus.Code)
			})
		}
	})

	t.Run("should not be able to create team without a title", func(t *testing.T) {
		ctx := context.Background()
		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		toCreate := helper.LoadYAMLOrJSONFile("../testdata/team-test-no-title-v0.yaml")

		_, err := teamClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "the team must have a title")
	})

	t.Run("should not be able to create provisioned team as a user", func(t *testing.T) {
		ctx := context.Background()
		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		toCreate := helper.LoadYAMLOrJSONFile("../testdata/team-test-provisioned-v0.yaml")

		_, err := teamClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "provisioned teams are only allowed for service accounts")
	})

	t.Run("should not be able to set externalUID when not provisioned", func(t *testing.T) {
		ctx := context.Background()
		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		toCreate := helper.LoadYAMLOrJSONFile("../testdata/team-test-external-uid-without-provisioned-v0.yaml")

		_, err := teamClient.Resource.Create(ctx, toCreate, metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.ErrStatus.Code)
		require.Contains(t, statusErr.ErrStatus.Message, "externalUID is only allowed for provisioned teams")
	})

	t.Run("should return AlreadyExists when creating a team with a taken name", func(t *testing.T) {
		ctx := context.Background()
		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		created, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = teamClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}) })

		_, err = teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/team-test-create-v0.yaml"), metav1.CreateOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(409), statusErr.ErrStatus.Code)
	})

	t.Run("should create team with generateName and get it using the new APIs as a GrafanaAdmin", func(t *testing.T) {
		ctx := context.Background()

		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		created, err := teamClient.Resource.Create(ctx, helper.LoadYAMLOrJSONFile("../testdata/team-test-generate-name-v0.yaml"), metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, created)

		createdSpec := created.Object["spec"].(map[string]interface{})
		require.Equal(t, "Team with GenerateName", createdSpec["title"])
		require.Equal(t, false, createdSpec["provisioned"])

		createdUID := created.GetName()
		require.NotEmpty(t, createdUID)
		require.Contains(t, createdUID, "team-")

		fetched, err := teamClient.Resource.Get(ctx, createdUID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, fetched)

		fetchedSpec := fetched.Object["spec"].(map[string]interface{})
		require.Equal(t, "Team with GenerateName", fetchedSpec["title"])
		require.Equal(t, false, fetchedSpec["provisioned"])

		require.Equal(t, createdUID, fetched.GetName())
		require.Equal(t, "default", fetched.GetNamespace())

		// Cleanup
		err = teamClient.Resource.Delete(ctx, createdUID, metav1.DeleteOptions{})
		require.NoError(t, err)
	})

	t.Run("should list teams correctly", func(t *testing.T) {
		ctx := context.Background()

		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		// For ensuring that it is able to list a team which has external_uid = null and is_provisioned = null
		// only matters when legacy storage is involved
		env := helper.GetEnv()
		res, err := env.SQLStore.GetSqlxSession().Exec(ctx, "INSERT INTO team (org_id, uid, name, email, is_provisioned, external_uid, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			helper.Org1.Admin.Identity.GetOrgID(), "t000000001", "List Team 1", "list-team-1@example.com", nil, nil, time.Now(), time.Now())
		require.NoError(t, err)
		require.NotNil(t, res)

		withoutEmail, err := env.SQLStore.GetSqlxSession().Exec(ctx, "INSERT INTO team (org_id, uid, name, email, is_provisioned, external_uid, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			helper.Org1.Admin.Identity.GetOrgID(), "t000000002", "List Team 2", nil, nil, nil, time.Now(), time.Now())
		require.NoError(t, err)
		require.NotNil(t, withoutEmail)

		list, err := teamClient.Resource.List(ctx, metav1.ListOptions{})
		require.NoError(t, err)
		require.NotNil(t, list)

		// Cleanup
		_, err = env.SQLStore.GetSqlxSession().Exec(ctx, "DELETE FROM team WHERE uid IN (?, ?)", "t000000001", "t000000002")
		require.NoError(t, err)
	})
}

func doTeamCRUDTestsUsingTheLegacyAPIs(t *testing.T, helper *apis.K8sTestHelper, mode rest.DualWriterMode) {
	t.Run("should create team using legacy APIs and get/update/delete it using the new APIs", func(t *testing.T) {
		ctx := context.Background()

		teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
			User:      helper.Org1.Admin,
			Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
			GVR:       gvrTeams,
		})

		legacyTeamPayload := `{
			"name": "Test Team 2",
			"email": "testteam2@example.com"
		}`

		type legacyCreateResponse struct {
			UID string `json:"uid"`
			ID  int64  `json:"teamId"`
		}

		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: "POST",
			Path:   "/api/teams",
			Body:   []byte(legacyTeamPayload),
		}, &legacyCreateResponse{})

		require.NotNil(t, rsp)
		require.Equal(t, 200, rsp.Response.StatusCode)
		require.NotEmpty(t, rsp.Result.UID)

		team, err := teamClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, team)

		teamSpec := team.Object["spec"].(map[string]interface{})
		require.Equal(t, "Test Team 2", teamSpec["title"])
		require.Equal(t, "testteam2@example.com", teamSpec["email"])
		require.Equal(t, false, teamSpec["provisioned"])

		require.Equal(t, rsp.Result.UID, team.GetName())
		require.Equal(t, "default", team.GetNamespace())

		// Updating the team is not supported in Mode2 if the team has been created using the legacy APIs
		if mode < rest.Mode2 {
			team.Object["spec"].(map[string]interface{})["title"] = "Updated Test Team 2"
			team.Object["spec"].(map[string]interface{})["email"] = "updated@example.com"

			updatedTeam, err := teamClient.Resource.Update(ctx, team, metav1.UpdateOptions{})
			require.NoError(t, err)
			require.NotNil(t, updatedTeam)

			updatedSpec := updatedTeam.Object["spec"].(map[string]interface{})
			require.Equal(t, "Updated Test Team 2", updatedSpec["title"])
			require.Equal(t, "updated@example.com", updatedSpec["email"])
			require.Equal(t, false, updatedSpec["provisioned"])

			verifiedTeam, err := teamClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
			require.NoError(t, err)
			require.NotNil(t, verifiedTeam)

			verifiedSpec := verifiedTeam.Object["spec"].(map[string]interface{})
			require.Equal(t, "Updated Test Team 2", verifiedSpec["title"])
			require.Equal(t, "updated@example.com", verifiedSpec["email"])
			require.Equal(t, false, verifiedSpec["provisioned"])
		}

		// Delete the team
		err = teamClient.Resource.Delete(ctx, rsp.Result.UID, metav1.DeleteOptions{})
		require.NoError(t, err)

		_, err = teamClient.Resource.Get(ctx, rsp.Result.UID, metav1.GetOptions{})
		require.Error(t, err)
		var statusErr *errors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, "Failure", statusErr.ErrStatus.Status)
		require.Contains(t, statusErr.ErrStatus.Message, "not found")
	})
}

func doTeamSpecMembersTests(t *testing.T, helper *apis.K8sTestHelper) {
	teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
		GVR:       gvrTeams,
	})

	editorUID := helper.Org1.Editor.Identity.GetIdentifier()
	viewerUID := helper.Org1.Viewer.Identity.GetIdentifier()

	newTeamWithMembers := func(prefix string, members []map[string]interface{}) *unstructured.Unstructured {
		body := map[string]interface{}{
			"apiVersion": "iam.grafana.app/v0alpha1",
			"kind":       "Team",
			"metadata":   map[string]interface{}{"generateName": prefix},
			"spec": map[string]interface{}{
				"title":       "Team " + prefix,
				"email":       prefix + "@example.com",
				"provisioned": false,
				"externalUID": "",
				"members":     members,
			},
		}
		return &unstructured.Unstructured{Object: body}
	}

	memberSpec := func(uid, permission string, external bool) map[string]interface{} {
		return map[string]interface{}{
			"kind":       "User",
			"name":       uid,
			"permission": permission,
			"external":   external,
		}
	}

	t.Run("should create team with members and hydrate on Get", func(t *testing.T) {
		ctx := context.Background()
		obj := newTeamWithMembers("team-members-", []map[string]interface{}{
			memberSpec(editorUID, "member", false),
		})
		created, err := teamClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = teamClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}) })

		fetched, err := teamClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		members, found, err := unstructured.NestedSlice(fetched.Object, "spec", "members")
		require.NoError(t, err)
		require.True(t, found)
		require.Len(t, members, 1)
		m := members[0].(map[string]interface{})
		require.Equal(t, "User", m["kind"])
		require.Equal(t, editorUID, m["name"])
		require.Equal(t, "member", m["permission"])
		require.Equal(t, false, m["external"])
	})

	t.Run("should add, update permission, and remove members via Update", func(t *testing.T) {
		ctx := context.Background()
		obj := newTeamWithMembers("team-members-upd-", []map[string]interface{}{
			memberSpec(editorUID, "member", false),
		})
		created, err := teamClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = teamClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}) })

		// Add viewer as admin alongside editor
		fetched, err := teamClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.NoError(t, unstructured.SetNestedSlice(fetched.Object, []interface{}{
			memberSpec(editorUID, "member", false),
			memberSpec(viewerUID, "admin", false),
		}, "spec", "members"))
		updated, err := teamClient.Resource.Update(ctx, fetched, metav1.UpdateOptions{})
		require.NoError(t, err)
		members, _, _ := unstructured.NestedSlice(updated.Object, "spec", "members")
		require.Len(t, members, 2)

		// Promote editor to admin
		fetched, err = teamClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.NoError(t, unstructured.SetNestedSlice(fetched.Object, []interface{}{
			memberSpec(editorUID, "admin", false),
			memberSpec(viewerUID, "admin", false),
		}, "spec", "members"))
		updated, err = teamClient.Resource.Update(ctx, fetched, metav1.UpdateOptions{})
		require.NoError(t, err)
		members, _, _ = unstructured.NestedSlice(updated.Object, "spec", "members")
		require.Len(t, members, 2)
		for _, raw := range members {
			m := raw.(map[string]interface{})
			require.Equal(t, "admin", m["permission"])
		}

		// Remove viewer
		fetched, err = teamClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.NoError(t, unstructured.SetNestedSlice(fetched.Object, []interface{}{
			memberSpec(editorUID, "admin", false),
		}, "spec", "members"))
		updated, err = teamClient.Resource.Update(ctx, fetched, metav1.UpdateOptions{})
		require.NoError(t, err)
		members, _, _ = unstructured.NestedSlice(updated.Object, "spec", "members")
		require.Len(t, members, 1)
		m := members[0].(map[string]interface{})
		require.Equal(t, editorUID, m["name"])
	})

	t.Run("should reject toggling external on an existing member", func(t *testing.T) {
		ctx := context.Background()
		obj := newTeamWithMembers("team-members-ext-", []map[string]interface{}{
			memberSpec(editorUID, "member", false),
		})
		created, err := teamClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = teamClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}) })

		require.NoError(t, unstructured.SetNestedSlice(created.Object, []interface{}{
			memberSpec(editorUID, "member", true),
		}, "spec", "members"))
		_, err = teamClient.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.Error(t, err)
		var se *errors.StatusError
		require.ErrorAs(t, err, &se)
		require.Equal(t, int32(400), se.ErrStatus.Code)
		require.Contains(t, se.ErrStatus.Message, "external")
	})

	// Guards the ErrTeamMemberAlreadyAdded → apierrors.NewConflict mapping on
	// the Update path. Several goroutines race to add the same user; if two
	// reach legacy.UpdateTeam before either commits, the second INSERT hits the
	// UNIQUE(org_id, team_id, user_id) constraint and the store must surface a
	// 409 (not a 500) so the client can retry.
	t.Run("concurrent adds of the same member never return 500", func(t *testing.T) {
		ctx := context.Background()
		obj := newTeamWithMembers("team-members-race-", []map[string]interface{}{})
		created, err := teamClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = teamClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}) })

		const parallel = 10
		var wg sync.WaitGroup
		errs := make([]error, parallel)
		start := make(chan struct{})
		for i := 0; i < parallel; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				<-start
				fetched, getErr := teamClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
				if getErr != nil {
					errs[i] = getErr
					return
				}
				if err := unstructured.SetNestedSlice(fetched.Object, []interface{}{
					memberSpec(editorUID, "member", false),
				}, "spec", "members"); err != nil {
					errs[i] = err
					return
				}
				_, errs[i] = teamClient.Resource.Update(ctx, fetched, metav1.UpdateOptions{})
			}(i)
		}
		close(start)
		wg.Wait()

		successes := 0
		for i, e := range errs {
			if e == nil {
				successes++
				continue
			}
			var se *errors.StatusError
			require.ErrorAs(t, e, &se, "goroutine %d returned non-status error: %v", i, e)
			require.NotEqual(t, int32(500), se.ErrStatus.Code,
				"goroutine %d got 500 (%q); member-add race must surface as 409", i, se.ErrStatus.Message)
		}
		require.Greater(t, successes, 0, "expected at least one goroutine to succeed")

		// Final state must contain the user exactly once regardless of race
		// outcomes, proving the retries converge.
		final, err := teamClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		members, _, _ := unstructured.NestedSlice(final.Object, "spec", "members")
		require.Len(t, members, 1)
		m := members[0].(map[string]interface{})
		require.Equal(t, editorUID, m["name"])
	})

	// /teams/{name}/addMember and /teams/{name}/removeMember target a single
	// team_member row per call, avoiding the stale-snapshot full-replace
	// hazard the PUT path has. This test covers the happy path (insert /
	// hydrate / delete) and the idempotency contract: addMember returns
	// 201 on a fresh insert and 200 on a re-add, removeMember returns 200
	// whether or not the row existed.
	t.Run("addMember/removeMember subresources are atomic and idempotent", func(t *testing.T) {
		ctx := context.Background()
		obj := newTeamWithMembers("team-members-subres-", []map[string]interface{}{})
		created, err := teamClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = teamClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}) })
		teamUID := created.GetName()
		namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())

		addPath := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/teams/%s/addmember", namespace, teamUID)
		removePath := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/teams/%s/removemember", namespace, teamUID)
		addBody := func(uid, perm string, external bool) []byte {
			b, err := json.Marshal(map[string]interface{}{"name": uid, "permission": perm, "external": external})
			require.NoError(t, err)
			return b
		}
		removeBody := func(uid string) []byte {
			b, err := json.Marshal(map[string]interface{}{"name": uid})
			require.NoError(t, err)
			return b
		}

		// addMember inserts the row; Get on the parent Team hydrates it
		// back through the same Spec.Members slice the PUT path uses.
		// First call returns 201 Created (fresh insert).
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User: helper.Org1.Admin, Method: "POST", Path: addPath, Body: addBody(editorUID, "member", true),
		}, &map[string]interface{}{})
		require.Equal(t, 201, rsp.Response.StatusCode, "first addMember should be 201 Created, got %d (%s)", rsp.Response.StatusCode, string(rsp.Body))

		fetched, err := teamClient.Resource.Get(ctx, teamUID, metav1.GetOptions{})
		require.NoError(t, err)
		members, _, _ := unstructured.NestedSlice(fetched.Object, "spec", "members")
		require.Len(t, members, 1)
		require.Equal(t, editorUID, members[0].(map[string]interface{})["name"])

		// Re-adding the same user is an idempotent no-op: the handler
		// short-circuits before the Update and returns 200 OK (vs the
		// fresh-insert 201) so a converged-but-resynced run doesn't
		// surface as an error.
		rsp = apis.DoRequest(helper, apis.RequestParams{
			User: helper.Org1.Admin, Method: "POST", Path: addPath, Body: addBody(editorUID, "member", true),
		}, &map[string]interface{}{})
		require.Equal(t, 200, rsp.Response.StatusCode, "second addMember should be idempotent 200, got %d (%s)", rsp.Response.StatusCode, string(rsp.Body))

		// removeMember deletes the row.
		rsp = apis.DoRequest(helper, apis.RequestParams{
			User: helper.Org1.Admin, Method: "POST", Path: removePath, Body: removeBody(editorUID),
		}, &map[string]interface{}{})
		require.Equal(t, 200, rsp.Response.StatusCode, "removeMember response: %s", string(rsp.Body))

		fetched, err = teamClient.Resource.Get(ctx, teamUID, metav1.GetOptions{})
		require.NoError(t, err)
		members, _, _ = unstructured.NestedSlice(fetched.Object, "spec", "members")
		require.Empty(t, members)

		// removeMember on an absent membership is a no-op success
		// (removed=false), not 404, so concurrent removeMember calls
		// from peer instances don't surface as errors that increment
		// the failure counter.
		rsp = apis.DoRequest(helper, apis.RequestParams{
			User: helper.Org1.Admin, Method: "POST", Path: removePath, Body: removeBody(editorUID),
		}, &map[string]interface{}{})
		require.Equal(t, 200, rsp.Response.StatusCode, "second removeMember should be 200 idempotent, got %d (%s)", rsp.Response.StatusCode, string(rsp.Body))
	})

	// Concurrent /addMember of *different* users on the same team is the
	// scenario that silently lost members through the full PUT path. With
	// the subresource each call inserts exactly one team_member row and
	// the full-list semantics never come into play, so both members must
	// always end up on the team. The handler returns 409 Conflict on
	// RV-collision (no in-handler retry), so callers must retry.
	t.Run("concurrent addMember of different users preserves every membership", func(t *testing.T) {
		ctx := context.Background()
		obj := newTeamWithMembers("team-members-subres-race-", []map[string]interface{}{})
		created, err := teamClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = teamClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}) })
		teamUID := created.GetName()
		namespace := helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID())
		addPath := fmt.Sprintf("/apis/iam.grafana.app/v0alpha1/namespaces/%s/teams/%s/addmember", namespace, teamUID)

		members := []string{editorUID, viewerUID}
		var wg sync.WaitGroup
		barrier := make(chan struct{})
		results := make([]struct {
			finalCode   int
			sawConflict bool
			attempts    int
		}, len(members))
		for i, uid := range members {
			wg.Add(1)
			go func(i int, uid string) {
				defer wg.Done()
				<-barrier
				body, err := json.Marshal(map[string]interface{}{"name": uid, "permission": "member", "external": true})
				require.NoError(t, err)
				// Retry on 409 with a small bounded budget.
				const maxAttempts = 8
				var code int
				for attempt := 1; attempt <= maxAttempts; attempt++ {
					rsp := apis.DoRequest(helper, apis.RequestParams{
						User: helper.Org1.Admin, Method: "POST", Path: addPath, Body: body,
					}, &map[string]interface{}{})
					code = rsp.Response.StatusCode
					results[i].attempts = attempt
					if code != 409 {
						break
					}
					results[i].sawConflict = true
					time.Sleep(time.Duration(attempt) * 25 * time.Millisecond)
				}
				results[i].finalCode = code
			}(i, uid)
		}
		close(barrier)
		wg.Wait()
		for i, r := range results {
			uid := ""
			if i < len(members) {
				uid = members[i]
			}
			require.Truef(t, r.finalCode == 200 || r.finalCode == 201,
				"goroutine %d (uid=%s) addMember should converge to 200/201 after retries, got %d in %d attempts",
				i, uid, r.finalCode, r.attempts)
		}

		fetched, err := teamClient.Resource.Get(ctx, teamUID, metav1.GetOptions{})
		require.NoError(t, err)
		final, _, _ := unstructured.NestedSlice(fetched.Object, "spec", "members")
		names := make([]string, 0, len(final))
		for _, raw := range final {
			names = append(names, raw.(map[string]interface{})["name"].(string))
		}
		require.ElementsMatch(t, members, names, "no member should be silently lost")
	})

	// Cross-instance writers race here: instance A and instance B both Get
	// the team at the same RV, each appends a different user to its own
	// stale Spec.Members snapshot, and both submit Update. Without an RV
	// precondition, B's full-replace Update silently drops the user A just
	// added because that user isn't on B's submitted list.
	//
	// In a single-process integration test the in-flight Updates serialise
	// inside the apiserver, so we simulate the cross-instance behaviour by
	// keeping a stale snapshot in memory while another writer commits, then
	// replaying the stale snapshot.
	t.Run("stale-RV update with different members must not silently drop members", func(t *testing.T) {
		ctx := context.Background()
		obj := newTeamWithMembers("team-members-stalerv-", []map[string]interface{}{})
		created, err := teamClient.Resource.Create(ctx, obj, metav1.CreateOptions{})
		require.NoError(t, err)
		t.Cleanup(func() { _ = teamClient.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}) })

		// Stale snapshot taken before interface{} member is added.
		stale, err := teamClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)

		// Peer instance commits first: editor is now on the team.
		fresh, err := teamClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.NoError(t, unstructured.SetNestedSlice(fresh.Object, []interface{}{
			memberSpec(editorUID, "member", false),
		}, "spec", "members"))
		_, err = teamClient.Resource.Update(ctx, fresh, metav1.UpdateOptions{})
		require.NoError(t, err)

		// This instance's Update — built from the stale snapshot — appends
		// viewer. With the RV precondition the apiserver returns 409, the
		// caller refreshes, and both editor and viewer end up on the team.
		require.NoError(t, unstructured.SetNestedSlice(stale.Object, []interface{}{
			memberSpec(viewerUID, "member", false),
		}, "spec", "members"))
		_, err = teamClient.Resource.Update(ctx, stale, metav1.UpdateOptions{})
		require.Error(t, err, "stale-RV update must be rejected, otherwise editor is silently removed")
		require.True(t, errors.IsConflict(err), "stale-RV update must surface as 409 Conflict, got %v", err)

		// Refresh and retry.
		refreshed, err := teamClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		current, _, _ := unstructured.NestedSlice(refreshed.Object, "spec", "members")
		current = append(current, memberSpec(viewerUID, "member", false))
		require.NoError(t, unstructured.SetNestedSlice(refreshed.Object, current, "spec", "members"))
		_, err = teamClient.Resource.Update(ctx, refreshed, metav1.UpdateOptions{})
		require.NoError(t, err)

		final, err := teamClient.Resource.Get(ctx, created.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		finalMembers, _, _ := unstructured.NestedSlice(final.Object, "spec", "members")
		names := make([]string, 0, len(finalMembers))
		for _, raw := range finalMembers {
			m := raw.(map[string]interface{})
			names = append(names, m["name"].(string))
		}
		require.ElementsMatch(t, []string{editorUID, viewerUID}, names,
			"both members must be present; the stale-RV writer must not have erased editor")
	})
}

// doTeamSpecExternalGroupsOSSTests covers spec.externalGroups behavior that
// is universal regardless of which ExternalGroupReconciler is bound. Hydration
// is reconciler-dependent and exercised in the enterprise suite.
func doTeamSpecExternalGroupsOSSTests(t *testing.T, helper *apis.K8sTestHelper) {
	teamClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User:      helper.Org1.Admin,
		Namespace: helper.Namespacer(helper.Org1.Admin.Identity.GetOrgID()),
		GVR:       gvrTeams,
	})

	t.Run("spec.externalGroups: validation rejects duplicates after lowercasing", func(t *testing.T) {
		ctx := context.Background()
		body := map[string]interface{}{
			"apiVersion": "iam.grafana.app/v0alpha1",
			"kind":       "Team",
			"metadata":   map[string]interface{}{"generateName": "team-egroups-dup-"},
			"spec": map[string]interface{}{
				"title":          "Team egroups dup",
				"email":          "egroups-dup@example.com",
				"provisioned":    false,
				"externalUID":    "",
				"externalGroups": []interface{}{"LDAP-Admins", "  ldap-admins  "},
			},
		}
		_, err := teamClient.Resource.Create(ctx, &unstructured.Unstructured{Object: body}, metav1.CreateOptions{})
		require.Error(t, err)
		var se *errors.StatusError
		require.ErrorAs(t, err, &se)
		require.Equal(t, int32(400), se.ErrStatus.Code)
		require.Contains(t, se.ErrStatus.Message, "duplicate")
	})
}
