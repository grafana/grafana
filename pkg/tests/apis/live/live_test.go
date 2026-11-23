package live

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/websocket"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	livev1 "github.com/grafana/grafana/apps/live/pkg/apis/live/v1alpha1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationLiveWebsocket(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:    false, // live.runAPIServer requires dev mode
		DisableAnonymous:     true,
		EnableFeatureToggles: []string{featuremgmt.FlagLiveRunAPIServer, featuremgmt.FlagGrafanaUseRouterMiddleware},
	})
	t.Cleanup(helper.Shutdown)

	addr := helper.GetListenerAddress()
	defaultNS := helper.Namespacer(helper.Org1.OrgID)

	t.Run("setup", func(t *testing.T) {
		t.Run("group is listed", func(t *testing.T) {
			// The version has no resources, so check the group list rather than
			// aggregated discovery.
			rsp := apis.DoRequest(helper, apis.RequestParams{
				User: helper.Org1.Viewer,
				Path: "/apis",
			}, &metav1.APIGroupList{})
			require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
			var found bool
			for _, g := range rsp.Result.Groups {
				if g.Name == "live.grafana.app" {
					found = true
					require.Equal(t, "v1alpha1", g.PreferredVersion.Version)
				}
			}
			require.True(t, found, "live.grafana.app should be in the API group list")
		})

		t.Run("group is in aggregated discovery", func(t *testing.T) {
			info, err := helper.GetGroupVersionInfoJSON("live.grafana.app")
			require.NoError(t, err)
			require.Contains(t, info, "v1alpha1")
		})

		t.Run("router serves the group and its manifest", func(t *testing.T) {
			require.EventuallyWithT(t, func(c *assert.CollectT) {
				status := apis.DoRequest(helper, apis.RequestParams{
					User: helper.Org1.Admin,
					Path: "/apis/discovery/v1alpha2/status",
				}, &struct {
					Ready  bool `json:"ready"`
					Groups []struct {
						Group string `json:"group"`
					} `json:"groups"`
				}{})
				if !assert.Equal(c, http.StatusOK, status.Response.StatusCode) || !assert.True(c, status.Result.Ready) {
					return
				}
				groups := make([]string, 0, len(status.Result.Groups))
				for _, g := range status.Result.Groups {
					groups = append(groups, g.Group)
				}
				assert.Contains(c, groups, "live.grafana.app", "router status groups")
			}, 30*time.Second, 100*time.Millisecond)

			manifests := apis.DoRequest(helper, apis.RequestParams{
				User: helper.Org1.Admin,
				Path: "/apis/discovery/v1alpha2/manifests",
			}, &struct {
				Items []struct {
					Metadata metav1.ObjectMeta `json:"metadata"`
				} `json:"items"`
			}{})
			require.Equal(t, http.StatusOK, manifests.Response.StatusCode)
			names := make([]string, 0, len(manifests.Result.Items))
			for _, m := range manifests.Result.Items {
				names = append(names, m.Metadata.Name)
			}
			require.Contains(t, names, "live.grafana.app")
		})

		t.Run("openapi index lists the version", func(t *testing.T) {
			// The swagger UI builds its spec picker from this index.
			rsp := apis.DoRequest(helper, apis.RequestParams{
				User: helper.Org1.Viewer,
				Path: "/openapi/v3",
			}, &struct {
				Paths map[string]any `json:"paths"`
			}{})
			require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
			require.Contains(t, rsp.Result.Paths, "apis/live.grafana.app/v1alpha1")
		})

		t.Run("route is documented in openapi", func(t *testing.T) {
			rsp := apis.DoRequest(helper, apis.RequestParams{
				User: helper.Org1.Viewer,
				Path: "/openapi/v3/apis/live.grafana.app/v1alpha1",
			}, &map[string]any{})
			require.Equal(t, http.StatusOK, rsp.Response.StatusCode)
			require.Contains(t, string(rsp.Body), `/apis/live.grafana.app/v1alpha1/namespaces/{namespace}/ws`)
		})

		tests := []struct {
			name      string
			user      *apis.User
			namespace string
			upgrade   bool
			want      int
		}{
			{name: "viewer in own namespace", user: &helper.Org1.Viewer, namespace: defaultNS, upgrade: true, want: http.StatusSwitchingProtocols},
			{name: "user from another org", user: &helper.OrgB.Viewer, namespace: defaultNS, upgrade: true, want: http.StatusForbidden},
			{name: "anonymous", namespace: defaultNS, upgrade: true, want: http.StatusUnauthorized},
			// Served by the raw route, not the k8s chain: Centrifuge rejects a request without an upgrade.
			{name: "without upgrade", user: &helper.Org1.Viewer, namespace: defaultNS, want: http.StatusBadRequest},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				req, err := http.NewRequest(http.MethodGet, "http://"+addr+wsPath(tt.namespace), nil)
				require.NoError(t, err)
				if tt.upgrade {
					req.Header.Set("Connection", "Upgrade")
					req.Header.Set("Upgrade", "websocket")
					req.Header.Set("Sec-WebSocket-Version", "13")
					req.Header.Set("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==")
				}
				if tt.user != nil {
					req.Header.Set("Authorization", basicAuth(*tt.user))
				}
				rsp, err := http.DefaultClient.Do(req)
				require.NoError(t, err)
				require.NoError(t, rsp.Body.Close())
				require.Equal(t, tt.want, rsp.StatusCode)
			})
		}

		t.Run("centrifuge connect", func(t *testing.T) {
			c := dial(t, addr, wsPath(defaultNS), helper.Org1.Viewer)
			reply := c.connect(t)
			require.NotEmpty(t, reply.Connect.Client)
		})
	})

	t.Run("events", func(t *testing.T) {
		ctx := context.Background()
		dashboards := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Admin,
			GVR:  dashv1.DashboardResourceInfo.GroupVersionResource(),
		})
		created, err := dashboards.Resource.Create(ctx, &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": dashv1.DashboardResourceInfo.GroupVersion().String(),
			"kind":       "Dashboard",
			"metadata":   map[string]any{"name": "live-events"},
			"spec":       map[string]any{"title": "Live events", "schemaVersion": 41},
		}}, metav1.CreateOptions{})
		require.NoError(t, err)

		channel := defaultNS + "/grafana/dashboard/uid/" + created.GetName()

		// One subscriber on the new path and one on /api/live/ws: both are served by
		// the same Live node, so a save must reach both. The admin subscribes because
		// the dashboard channel requires read access to the dashboard.
		newPath := dial(t, addr, wsPath(defaultNS), helper.Org1.Admin)
		newPath.connect(t)
		newPath.subscribe(t, channel)

		legacyPath := dial(t, addr, "/api/live/ws", helper.Org1.Admin)
		legacyPath.connect(t)
		legacyPath.subscribe(t, channel)

		spec := created.Object["spec"].(map[string]any)
		spec["title"] = "Live events (updated)"
		updated, err := dashboards.Resource.Update(ctx, created, metav1.UpdateOptions{})
		require.NoError(t, err)

		for _, sub := range []struct {
			name string
			conn *centrifugeConn
		}{{"new path", newPath}, {"legacy path", legacyPath}} {
			t.Run(sub.name, func(t *testing.T) {
				push := sub.conn.waitForPush(t, channel)
				var event struct {
					UID             string `json:"uid"`
					Action          string `json:"action"`
					ResourceVersion string `json:"rv"`
				}
				require.NoError(t, json.Unmarshal(push.Pub.Data, &event))
				require.Equal(t, created.GetName(), event.UID)
				require.Equal(t, "saved", event.Action)
				require.Equal(t, updated.GetResourceVersion(), event.ResourceVersion)
			})
		}
	})

	t.Run("channels", func(t *testing.T) {
		ctx := context.Background()
		channels := helper.GetResourceClient(apis.ResourceClientArgs{
			User: helper.Org1.Viewer,
			GVR:  livev1.ChannelKind().GroupVersionResource(),
		})
		const path = "stream/integration-test/cpu"

		// Subscribe before pushing, so the push is delivered as an event.
		sub := dial(t, addr, wsPath(defaultNS), helper.Org1.Admin)
		sub.connect(t)
		sub.subscribe(t, defaultNS+"/"+path)

		// Managed streams are created by pushing to them.
		rsp := apis.DoRequest(helper, apis.RequestParams{
			User:        helper.Org1.Editor,
			Method:      http.MethodPost,
			Path:        "/api/live/push/integration-test",
			Body:        []byte("cpu value=1.5"),
			ContentType: "text/plain",
		}, &map[string]any{})
		require.Equal(t, http.StatusOK, rsp.Response.StatusCode, string(rsp.Body))

		t.Run("push reaches the subscriber", func(t *testing.T) {
			push := sub.waitForPush(t, defaultNS+"/"+path)
			require.Contains(t, string(push.Pub.Data), "1.5")
		})

		t.Run("list and get", func(t *testing.T) {
			list, err := channels.Resource.List(ctx, metav1.ListOptions{})
			require.NoError(t, err)
			var found *unstructured.Unstructured
			for i := range list.Items {
				if list.Items[i].GetName() == "stream.integration-test.cpu" {
					found = &list.Items[i]
				}
			}
			require.NotNil(t, found, "pushed channel should be listed")
			gotPath, _, _ := unstructured.NestedString(found.Object, "spec", "path")
			require.Equal(t, path, gotPath)
			_, hasRate, _ := unstructured.NestedFieldNoCopy(found.Object, "status", "minute_rate")
			require.True(t, hasRate, "status.minute_rate should be set")
			_, hasData, _ := unstructured.NestedMap(found.Object, "status", "data")
			require.True(t, hasData, "status.data should hold the frame schema")

			got, err := channels.Resource.Get(ctx, "stream.integration-test.cpu", metav1.GetOptions{})
			require.NoError(t, err)
			require.Equal(t, "stream.integration-test.cpu", got.GetName())

			_, err = channels.Resource.Get(ctx, "stream.integration-test.missing", metav1.GetOptions{})
			require.Error(t, err)
			require.Equal(t, int32(http.StatusNotFound), helper.AsStatusError(err).Status().Code)
		})

		t.Run("read-only", func(t *testing.T) {
			_, err := channels.Resource.Create(ctx, &unstructured.Unstructured{Object: map[string]any{
				"apiVersion": livev1.GroupVersion.String(),
				"kind":       "Channel",
				"metadata":   map[string]any{"name": "stream.integration-test.new"},
				"spec":       map[string]any{"path": "stream/integration-test/new"},
			}}, metav1.CreateOptions{})
			require.Error(t, err)
			require.Equal(t, int32(http.StatusMethodNotAllowed), helper.AsStatusError(err).Status().Code)
		})
	})
}

// wsPath is the live.grafana.app websocket path for a namespace.
func wsPath(namespace string) string {
	return fmt.Sprintf("/apis/live.grafana.app/v1alpha1/namespaces/%s/ws", namespace)
}

func basicAuth(user apis.User) string {
	cfg := user.NewRestConfig()
	return "Basic " + base64.StdEncoding.EncodeToString([]byte(cfg.Username+":"+cfg.Password))
}

// centrifugeConn speaks the Centrifuge v2 JSON protocol, which is what the
// Grafana frontend uses.
type centrifugeConn struct {
	ws     *websocket.Conn
	nextID int
	// frames read while waiting for something else
	pending []reply
}

type replyError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type reply struct {
	ID      int         `json:"id,omitempty"`
	Error   *replyError `json:"error,omitempty"`
	Connect *struct {
		Client string `json:"client"`
	} `json:"connect,omitempty"`
	Subscribe json.RawMessage `json:"subscribe,omitempty"`
	Push      *push           `json:"push,omitempty"`
}

type push struct {
	Channel string `json:"channel"`
	Pub     *struct {
		Data json.RawMessage `json:"data"`
	} `json:"pub,omitempty"`
}

func dial(t *testing.T, addr, path string, user apis.User) *centrifugeConn {
	t.Helper()
	cfg, err := websocket.NewConfig("ws://"+addr+path, "http://"+addr)
	require.NoError(t, err)
	cfg.Header.Set("Authorization", basicAuth(user))

	ws, err := websocket.DialConfig(cfg)
	require.NoError(t, err)
	t.Cleanup(func() { _ = ws.Close() })
	return &centrifugeConn{ws: ws, nextID: 1}
}

func (c *centrifugeConn) send(t *testing.T, cmd map[string]any) int {
	t.Helper()
	id := c.nextID
	c.nextID++
	cmd["id"] = id
	require.NoError(t, websocket.JSON.Send(c.ws, cmd))
	return id
}

// read returns the next reply, splitting frames that carry several
// newline-delimited replies.
func (c *centrifugeConn) read(t *testing.T) reply {
	t.Helper()
	if len(c.pending) > 0 {
		r := c.pending[0]
		c.pending = c.pending[1:]
		return r
	}
	require.NoError(t, c.ws.SetReadDeadline(time.Now().Add(10*time.Second)))
	var frame string
	require.NoError(t, websocket.Message.Receive(c.ws, &frame))
	for _, line := range strings.Split(strings.TrimSpace(frame), "\n") {
		if line == "" || line == "{}" { // server ping
			continue
		}
		var r reply
		require.NoError(t, json.Unmarshal([]byte(line), &r), line)
		c.pending = append(c.pending, r)
	}
	return c.read(t)
}

func (c *centrifugeConn) waitForReply(t *testing.T, id int) reply {
	t.Helper()
	for {
		r := c.read(t)
		if r.ID == id {
			require.Nil(t, r.Error, "command %d failed", id)
			return r
		}
	}
}

func (c *centrifugeConn) connect(t *testing.T) reply {
	t.Helper()
	r := c.waitForReply(t, c.send(t, map[string]any{"connect": map[string]any{}}))
	require.NotNil(t, r.Connect)
	return r
}

func (c *centrifugeConn) subscribe(t *testing.T, channel string) {
	t.Helper()
	r := c.waitForReply(t, c.send(t, map[string]any{"subscribe": map[string]any{"channel": channel}}))
	require.NotNil(t, r.Subscribe)
}

func (c *centrifugeConn) waitForPush(t *testing.T, channel string) *push {
	t.Helper()
	for {
		r := c.read(t)
		if r.Push != nil && r.Push.Channel == channel && r.Push.Pub != nil {
			return r.Push
		}
	}
}
