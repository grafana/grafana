package identity

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	natsserver "github.com/nats-io/nats-server/v2/server"
	natsclient "github.com/nats-io/nats.go"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/resourcewatch"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// TestIntegrationLegacyWatchNotifications listens on the legacy watch subjects
// with its own NATS client and checks that user and team writes to the legacy
// SQL tables are announced, both through the k8s API (the IAM legacy store) and
// through the legacy HTTP API (the user and team services).
func TestIntegrationLegacyWatchNotifications(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:      false,
		DisableAnonymous:       true,
		RBACSingleOrganization: true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagKubernetesTeamsApi,
			featuremgmt.FlagKubernetesUsersApi,
			featuremgmt.FlagGrafanaPublishLegacySQLEvents,
		},
		NATSEnabled:       true,
		NATSListenAddress: "127.0.0.1",
		NATSClientPort:    natsserver.RANDOM_PORT,
		NATSClusterPort:   natsserver.RANDOM_PORT,
	})

	nc, err := natsclient.Connect(strings.Join(helper.GetEnv().NATSConfig.URLs(), ","))
	require.NoError(t, err)
	t.Cleanup(nc.Close)

	type received struct {
		subject      string
		notification *resourcepb.WatchNotification
	}
	events := make(chan received, 100)
	sub, err := nc.Subscribe(resourcewatch.SubjectAllLegacyResources, func(msg *natsclient.Msg) {
		n := &resourcepb.WatchNotification{}
		if err := proto.Unmarshal(msg.Data, n); err != nil {
			n = nil // reported by expect
		}
		events <- received{subject: msg.Subject, notification: n}
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = sub.Unsubscribe() })
	// Flush round-trips to the server, so the subscription is live before any write.
	require.NoError(t, nc.Flush())

	// expect waits for the notification announcing typ on the named resource.
	// Notifications for other objects (e.g. the user that creates a team) are skipped.
	expect := func(t *testing.T, typ resourcepb.WatchNotification_Type, gvr schema.GroupVersionResource, name string) *resourcepb.WatchNotification {
		t.Helper()
		require.NotEmpty(t, name)
		timeout := time.After(10 * time.Second)
		for {
			select {
			case e := <-events:
				require.NotNil(t, e.notification, "undecodable notification on %s", e.subject)
				if e.notification.Name != name || e.notification.Resource != gvr.Resource {
					continue
				}
				require.Equal(t, resourcewatch.LegacySubject(gvr, "default"), e.subject)
				require.Equal(t, typ, e.notification.Type)
				require.Equal(t, gvr.Group, e.notification.Group)
				require.Equal(t, "default", e.notification.Namespace)
				return e.notification
			case <-timeout:
				t.Fatalf("no %s notification for %s %q", typ, gvr.Resource, name)
				return nil
			}
		}
	}

	t.Run("k8s API team", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvrTeams})

		created, err := client.Resource.Create(ctx, helper.LoadYAMLOrJSON(`{
			"apiVersion": "iam.grafana.app/v0alpha1",
			"kind": "Team",
			"metadata": {"name": "watch-team-k8s"},
			"spec": {"title": "Watch Team K8s", "email": "watch-team-k8s@example.com", "provisioned": false}
		}`), metav1.CreateOptions{})
		require.NoError(t, err)
		n := expect(t, resourcepb.WatchNotification_ADDED, gvrTeams, created.GetName())
		require.Positive(t, n.ResourceVersion)

		require.NoError(t, unstructured.SetNestedField(created.Object, "Watch Team K8s Renamed", "spec", "title"))
		_, err = client.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.NoError(t, err)
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrTeams, created.GetName())

		require.NoError(t, client.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}))
		expect(t, resourcepb.WatchNotification_DELETED, gvrTeams, created.GetName())
	})

	t.Run("k8s API user", func(t *testing.T) {
		ctx := context.Background()
		client := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvrUsers})

		created, err := client.Resource.Create(ctx, helper.LoadYAMLOrJSON(`{
			"apiVersion": "iam.grafana.app/v0alpha1",
			"kind": "User",
			"metadata": {"name": "watchuserk8s"},
			"spec": {"login": "watch-user-k8s", "email": "watch-user-k8s@example.com", "title": "Watch User K8s", "provisioned": false, "role": "None"}
		}`), metav1.CreateOptions{})
		require.NoError(t, err)
		n := expect(t, resourcepb.WatchNotification_ADDED, gvrUsers, created.GetName())
		require.Positive(t, n.ResourceVersion)

		require.NoError(t, unstructured.SetNestedField(created.Object, "Watch User K8s Renamed", "spec", "title"))
		_, err = client.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.NoError(t, err)
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrUsers, created.GetName())

		require.NoError(t, client.Resource.Delete(ctx, created.GetName(), metav1.DeleteOptions{}))
		expect(t, resourcepb.WatchNotification_DELETED, gvrUsers, created.GetName())
	})

	t.Run("legacy API team", func(t *testing.T) {
		type createTeamResponse struct {
			TeamID int64  `json:"teamId"`
			UID    string `json:"uid"`
		}
		created := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/teams",
			Body:   []byte(`{"name": "watch-team-legacy", "email": "watch-team-legacy@example.com"}`),
		}, &createTeamResponse{})
		require.Equal(t, http.StatusOK, created.Response.StatusCode, "body: %s", string(created.Body))
		uid := created.Result.UID
		n := expect(t, resourcepb.WatchNotification_ADDED, gvrTeams, uid)
		require.Positive(t, n.ResourceVersion)
		// Creating a team through the legacy API adds its creator as an admin member.
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrTeams, uid)

		updated := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPut,
			Path:   fmt.Sprintf("/api/teams/%d", created.Result.TeamID),
			Body:   []byte(`{"name": "watch-team-legacy-renamed", "email": "watch-team-legacy@example.com"}`),
		}, &struct{}{})
		require.Equal(t, http.StatusOK, updated.Response.StatusCode, "body: %s", string(updated.Body))
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrTeams, uid)

		deleted := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   fmt.Sprintf("/api/teams/%d", created.Result.TeamID),
		}, &struct{}{})
		require.Equal(t, http.StatusOK, deleted.Response.StatusCode, "body: %s", string(deleted.Body))
		expect(t, resourcepb.WatchNotification_DELETED, gvrTeams, uid)
	})

	t.Run("legacy API user", func(t *testing.T) {
		type createUserResponse struct {
			ID  int64  `json:"id"`
			UID string `json:"uid"`
		}
		created := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/admin/users",
			Body:   []byte(`{"name": "Watch User Legacy", "email": "watch-user-legacy@example.com", "login": "watch-user-legacy", "password": "password123"}`),
		}, &createUserResponse{})
		require.Equal(t, http.StatusOK, created.Response.StatusCode, "body: %s", string(created.Body))
		uid := created.Result.UID
		n := expect(t, resourcepb.WatchNotification_ADDED, gvrUsers, uid)
		require.Positive(t, n.ResourceVersion)

		updated := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPut,
			Path:   fmt.Sprintf("/api/users/%d", created.Result.ID),
			Body:   []byte(`{"name": "Watch User Legacy Renamed", "email": "watch-user-legacy@example.com", "login": "watch-user-legacy"}`),
		}, &struct{}{})
		require.Equal(t, http.StatusOK, updated.Response.StatusCode, "body: %s", string(updated.Body))
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrUsers, uid)

		deleted := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   fmt.Sprintf("/api/admin/users/%d", created.Result.ID),
		}, &struct{}{})
		require.Equal(t, http.StatusOK, deleted.Response.StatusCode, "body: %s", string(deleted.Body))
		expect(t, resourcepb.WatchNotification_DELETED, gvrUsers, uid)
	})

	gvrTeamBindings := schema.GroupVersionResource{Group: "iam.grafana.app", Version: "v0alpha1", Resource: "teambindings"}
	viewerUID := helper.Org1.Viewer.Identity.GetIdentifier()
	viewerID, err := helper.Org1.Viewer.Identity.GetInternalID()
	require.NoError(t, err)

	// bindingUID returns the name of the TeamBinding for the viewer's membership
	// of a team: the team_member row's UID, which neither API returns.
	bindingUID := func(t *testing.T, teamUID string) string {
		t.Helper()
		var uid string
		require.NoError(t, helper.GetEnv().SQLStore.WithDbSession(context.Background(), func(sess *db.Session) error {
			_, err := sess.SQL("SELECT tm.uid FROM team_member tm INNER JOIN team t ON t.id = tm.team_id WHERE t.uid = ? AND tm.user_id = ?", teamUID, viewerID).Get(&uid)
			return err
		}))
		require.NotEmpty(t, uid)
		return uid
	}

	t.Run("k8s API team membership", func(t *testing.T) {
		ctx := context.Background()
		teams := helper.GetResourceClient(apis.ResourceClientArgs{User: helper.Org1.Admin, GVR: gvrTeams})

		team, err := teams.Resource.Create(ctx, helper.LoadYAMLOrJSON(`{
			"apiVersion": "iam.grafana.app/v0alpha1",
			"kind": "Team",
			"metadata": {"name": "watch-team-members-k8s"},
			"spec": {"title": "Watch Team Members K8s", "email": "watch-team-members-k8s@example.com", "provisioned": false}
		}`), metav1.CreateOptions{})
		require.NoError(t, err)
		expect(t, resourcepb.WatchNotification_ADDED, gvrTeams, team.GetName())

		setMembers := func(t *testing.T, members ...any) {
			t.Helper()
			require.NoError(t, unstructured.SetNestedSlice(team.Object, members, "spec", "members"))
			team, err = teams.Resource.Update(ctx, team, metav1.UpdateOptions{})
			require.NoError(t, err)
		}
		viewer := func(permission string) any {
			return map[string]any{"kind": "User", "name": viewerUID, "permission": permission, "external": false}
		}

		setMembers(t, viewer("member"))
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrTeams, team.GetName())
		binding := bindingUID(t, team.GetName())
		expect(t, resourcepb.WatchNotification_ADDED, gvrTeamBindings, binding)

		setMembers(t, viewer("admin"))
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrTeams, team.GetName())
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrTeamBindings, binding)

		setMembers(t)
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrTeams, team.GetName())
		expect(t, resourcepb.WatchNotification_DELETED, gvrTeamBindings, binding)

		require.NoError(t, teams.Resource.Delete(ctx, team.GetName(), metav1.DeleteOptions{}))
		expect(t, resourcepb.WatchNotification_DELETED, gvrTeams, team.GetName())
	})

	t.Run("legacy API team membership", func(t *testing.T) {
		type createTeamResponse struct {
			TeamID int64  `json:"teamId"`
			UID    string `json:"uid"`
		}
		created := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   "/api/teams",
			Body:   []byte(`{"name": "watch-team-members-legacy", "email": "watch-team-members-legacy@example.com"}`),
		}, &createTeamResponse{})
		require.Equal(t, http.StatusOK, created.Response.StatusCode, "body: %s", string(created.Body))
		teamID, teamUID := created.Result.TeamID, created.Result.UID
		expect(t, resourcepb.WatchNotification_ADDED, gvrTeams, teamUID)

		added := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPost,
			Path:   fmt.Sprintf("/api/teams/%d/members", teamID),
			Body:   []byte(fmt.Sprintf(`{"userId": %d}`, viewerID)),
		}, &struct{}{})
		require.Equal(t, http.StatusOK, added.Response.StatusCode, "body: %s", string(added.Body))

		binding := bindingUID(t, teamUID)
		expect(t, resourcepb.WatchNotification_ADDED, gvrTeamBindings, binding)
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrTeams, teamUID)

		updated := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodPut,
			Path:   fmt.Sprintf("/api/teams/%d/members/%d", teamID, viewerID),
			Body:   []byte(`{"permission": 4}`),
		}, &struct{}{})
		require.Equal(t, http.StatusOK, updated.Response.StatusCode, "body: %s", string(updated.Body))
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrTeamBindings, binding)

		removed := apis.DoRequest(helper, apis.RequestParams{
			User:   helper.Org1.Admin,
			Method: http.MethodDelete,
			Path:   fmt.Sprintf("/api/teams/%d/members/%d", teamID, viewerID),
		}, &struct{}{})
		require.Equal(t, http.StatusOK, removed.Response.StatusCode, "body: %s", string(removed.Body))
		expect(t, resourcepb.WatchNotification_DELETED, gvrTeamBindings, binding)
		expect(t, resourcepb.WatchNotification_MODIFIED, gvrTeams, teamUID)
	})
}
