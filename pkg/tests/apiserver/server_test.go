package apiserver_test

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/dynamic"
	clientrest "k8s.io/client-go/rest"

	shorturlv1 "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1beta1"
	servicev0 "github.com/grafana/grafana/pkg/apis/service/v0alpha1"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/registry/apis/service"
	"github.com/grafana/grafana/pkg/registry/apps/shorturl"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/shorturls/shorturlimpl"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/apiserver"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/grafana/grafana/pkg/web"
)

func TestMain(m *testing.M) {
	apiserver.Run(m)
}

func TestIntegrationIsolation(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Parallel()
	processEnvironment := web.Env
	processTimeouts := sdkhttpclient.DefaultTimeoutOptions
	newEnvironment := func(t *testing.T) *apiserver.Environment {
		t.Helper()
		env := apiserver.New(t, apiserver.Options{
			Configure: func(cfg *setting.Cfg) {
				cfg.DataProxyTimeout = int(processTimeouts.Timeout/time.Second) + 17
			},
			Register: func(env *apiserver.Environment) {
				env.Registrar.RegisterAPI(service.NewServiceAPIBuilder())
				app, err := shorturl.RegisterAppInstaller(env.Cfg, shorturlimpl.ProvideService(env.DB))
				require.NoError(t, err)
				env.Registrar.RegisterAppInstaller(app)
			},
		})
		require.Equal(t, processTimeouts, sdkhttpclient.DefaultTimeoutOptions)
		require.Equal(t, processEnvironment, web.Env)
		return env
	}
	createCaller := func(t *testing.T, env *apiserver.Environment) apiserver.User {
		t.Helper()
		return env.CreateUser(t, &user.CreateUserCommand{
			UID: "same-user", Login: "same-user", Password: user.Password("test-password"),
			DefaultOrgRole: string(org.RoleAdmin),
		})
	}
	reference := newEnvironment(t)
	referenceClient, err := dynamic.NewForConfig(reference.ClientConfig(createCaller(t, reference)))
	require.NoError(t, err)
	for i := range 2 {
		t.Run(fmt.Sprintf("instance %d", i), func(t *testing.T) {
			t.Parallel()
			env := newEnvironment(t)
			client, err := dynamic.NewForConfig(env.ClientConfig(createCaller(t, env)))
			require.NoError(t, err)
			for _, resource := range []struct {
				info metav1.TypeMeta
				data map[string]any
			}{
				{metav1.TypeMeta{APIVersion: servicev0.SchemeGroupVersion.String(), Kind: "ExternalName"}, map[string]any{"host": fmt.Sprintf("instance-%d.example.com", i)}},
				{metav1.TypeMeta{APIVersion: shorturlv1.ShortURLKind().GroupVersionResource().GroupVersion().String(), Kind: "ShortURL"}, map[string]any{"path": fmt.Sprintf("d/instance-%d", i)}},
			} {
				gvr := servicev0.ExternalNameResourceInfo.GroupVersionResource()
				if resource.info.Kind == "ShortURL" {
					gvr = shorturlv1.ShortURLKind().GroupVersionResource()
				}
				api := client.Resource(gvr).Namespace("default")
				created, err := api.Create(t.Context(), &unstructured.Unstructured{Object: map[string]any{
					"apiVersion": resource.info.APIVersion, "kind": resource.info.Kind,
					"metadata": map[string]any{"name": "same-name"}, "spec": resource.data,
				}}, metav1.CreateOptions{})
				require.NoError(t, err, "create %s: %#v", resource.info.Kind, err)
				fetched, err := api.Get(t.Context(), created.GetName(), metav1.GetOptions{})
				require.NoError(t, err)
				require.Equal(t, resource.data, fetched.Object["spec"])
				list, err := api.List(t.Context(), metav1.ListOptions{})
				require.NoError(t, err)
				require.Len(t, list.Items, 1)
				untouched, err := referenceClient.Resource(gvr).Namespace("default").List(t.Context(), metav1.ListOptions{})
				require.NoError(t, err)
				require.Empty(t, untouched.Items, "another live environment must not see these writes")
			}
		})
	}
}

func TestIntegrationAuthenticationAndAuthorization(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Parallel()
	env := apiserver.New(t, apiserver.Options{
		Configure: func(cfg *setting.Cfg) {
			cfg.Raw.Section("authorization").Key("cache_ttl").SetValue("0s")
		},
		Register: func(env *apiserver.Environment) {
			env.Registrar.RegisterAPI(service.NewServiceAPIBuilder())
			env.Routes.Get("/api/test-permission", middleware.ReqSignedIn, func(c *contextmodel.ReqContext) {
				result, err := env.AccessClient.Check(c.Req.Context(), c.SignedInUser, types.CheckRequest{
					Group: "iam.grafana.app", Resource: "teams", Verb: "get",
					Name: c.Query("name"), Namespace: c.SignedInUser.Namespace,
				}, "")
				if err != nil {
					c.JsonApiErr(http.StatusInternalServerError, "permission check failed", err)
					return
				}
				loaded, err := env.AccessControl.Evaluate(c.Req.Context(), c.SignedInUser,
					accesscontrol.EvalPermission(accesscontrol.ActionTeamsRead, "teams:id:"+c.Query("id")))
				if err != nil || loaded != result.Allowed {
					c.JsonApiErr(http.StatusInternalServerError, "loaded and stored permissions disagree", err)
					return
				}
				if !result.Allowed {
					c.Resp.WriteHeader(http.StatusForbidden)
					return
				}
				c.Resp.WriteHeader(http.StatusNoContent)
			})
		},
	})
	admin := env.CreateUser(t, &user.CreateUserCommand{
		Login: "admin", Password: user.Password("admin-password"), DefaultOrgRole: string(org.RoleAdmin),
	})
	caller := env.CreateUser(t, &user.CreateUserCommand{
		Login: "scoped-user", Password: user.Password("scoped-password"), DefaultOrgRole: string(org.RoleNone),
	})
	disabled := env.CreateUser(t, &user.CreateUserCommand{
		Login: "disabled-user", Password: user.Password("disabled-password"),
		DefaultOrgRole: string(org.RoleAdmin), IsDisabled: true,
	})
	requestStatus := func(t *testing.T, caller apiserver.User, path string, want int) {
		t.Helper()
		client, err := clientrest.HTTPClientFor(env.ClientConfig(caller))
		require.NoError(t, err)
		req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, "http://grafana.test"+path, nil)
		require.NoError(t, err)
		req.Header.Set("Accept", "application/json")
		response, err := client.Do(req)
		require.NoError(t, err)
		defer response.Body.Close()
		body, err := io.ReadAll(response.Body)
		require.NoError(t, err)
		require.Equal(t, want, response.StatusCode, "%s", body)
	}
	gvr := servicev0.ExternalNameResourceInfo.GroupVersionResource()
	resourcePath := fmt.Sprintf("/apis/%s/namespaces/default/%s", gvr.GroupVersion(), gvr.Resource)
	wrongPassword := admin
	wrongPassword.Password = user.Password("incorrect-password")
	for _, tc := range []struct {
		name   string
		caller apiserver.User
		status int
	}{
		{name: "missing credentials", status: http.StatusUnauthorized},
		{name: "wrong password", caller: wrongPassword, status: http.StatusUnauthorized},
		{name: "disabled user", caller: disabled, status: http.StatusUnauthorized},
		{name: "authenticated admin", caller: admin, status: http.StatusOK},
		{name: "authenticated user without role", caller: caller, status: http.StatusForbidden},
	} {
		t.Run(tc.name, func(t *testing.T) { requestStatus(t, tc.caller, resourcePath, tc.status) })
	}
	t.Run("missing API route", func(t *testing.T) {
		requestStatus(t, admin, "/apis/missing.test/v1/namespaces/default/resources", http.StatusNotFound)
	})
	otherOrg, err := env.Organizations.CreateWithMember(env.Context(t.Context()), &org.CreateOrgCommand{
		Name: "Other Org.", UserID: caller.Identity.UserID,
	})
	require.NoError(t, err)
	require.NotEqual(t, admin.Identity.OrgID, otherOrg.ID, "cross-org checks require a distinct organization")
	t.Run("cross organization", func(t *testing.T) {
		path := fmt.Sprintf("/apis/%s/namespaces/org-%d/%s", gvr.GroupVersion(), otherOrg.ID, gvr.Resource)
		requestStatus(t, admin, path, http.StatusForbidden)
	})
	allowedTeam, err := env.Teams.CreateTeam(t.Context(), &team.CreateTeamCommand{Name: "Allowed team", OrgID: caller.Identity.OrgID})
	require.NoError(t, err)
	otherTeam, err := env.Teams.CreateTeam(t.Context(), &team.CreateTeamCommand{Name: "Other team", OrgID: caller.Identity.OrgID})
	require.NoError(t, err)
	allowedPath := fmt.Sprintf("/api/test-permission?name=%s&id=%d", allowedTeam.UID, allowedTeam.ID)
	otherPath := fmt.Sprintf("/api/test-permission?name=%s&id=%d", otherTeam.UID, otherTeam.ID)
	t.Run("persisted scoped grant and revocation", func(t *testing.T) {
		requestStatus(t, caller, allowedPath, http.StatusForbidden)
		requestStatus(t, caller, otherPath, http.StatusForbidden)
		store := resourcepermissions.NewStore(env.Cfg, env.DB, env.Features)
		permission := resourcepermissions.SetResourcePermissionCommand{
			Resource: "teams", ResourceAttribute: "id", ResourceID: strconv.FormatInt(allowedTeam.ID, 10),
			Actions: []string{accesscontrol.ActionTeamsRead},
		}
		_, err := store.SetUserResourcePermission(t.Context(), caller.Identity.OrgID,
			accesscontrol.User{ID: caller.Identity.UserID}, permission, nil)
		require.NoError(t, err)
		requestStatus(t, caller, allowedPath, http.StatusNoContent)
		requestStatus(t, caller, otherPath, http.StatusForbidden)
		permission.Actions = nil
		_, err = store.SetUserResourcePermission(t.Context(), caller.Identity.OrgID,
			accesscontrol.User{ID: caller.Identity.UserID}, permission, nil)
		require.NoError(t, err)
		requestStatus(t, caller, allowedPath, http.StatusForbidden)
	})
}

func TestIntegrationWatchShutdown(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Parallel()
	ctx := t.Context()
	var cancel context.CancelFunc
	defer func() {
		if cancel != nil {
			cancel()
		}
	}()
	var watcher watch.Interface
	t.Run("server", func(t *testing.T) {
		env := apiserver.New(t, apiserver.Options{
			Register: func(env *apiserver.Environment) {
				env.Registrar.RegisterAPI(service.NewServiceAPIBuilder())
			},
		})
		caller := env.CreateUser(t, &user.CreateUserCommand{
			Login: "watcher", Password: user.Password("test-password"), DefaultOrgRole: string(org.RoleAdmin),
		})
		client, err := dynamic.NewForConfig(env.ClientConfig(caller))
		require.NoError(t, err)
		ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
		watcher, err = client.Resource(servicev0.ExternalNameResourceInfo.GroupVersionResource()).Namespace("default").
			Watch(ctx, metav1.ListOptions{})
		require.NoError(t, err)
	})
	require.NotNil(t, watcher)
	defer watcher.Stop()
	select {
	case event, open := <-watcher.ResultChan():
		require.False(t, open, "watch must close when the environment stops: %#v", event)
	case <-ctx.Done():
		t.Fatal("watch survived server shutdown")
	}
}

func TestIntegrationFeatureFlags(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Parallel()
	newEnvironment := func(t *testing.T, enabled, configured bool) *apiserver.Environment {
		t.Helper()
		var flags []string
		if enabled && !configured {
			flags = []string{featuremgmt.FlagPlaylistsRBAC}
		}
		return apiserver.New(t, apiserver.Options{
			FeatureFlags: flags,
			Configure: func(cfg *setting.Cfg) {
				if configured {
					cfg.Raw.Section("feature_toggles").Key(featuremgmt.FlagPlaylistsRBAC).SetValue(strconv.FormatBool(enabled))
				}
			},
			Register: func(env *apiserver.Environment) {
				env.Routes.Get("/api/test-feature-flags", func(c *contextmodel.ReqContext) {
					ctx := c.Req.Context()
					c.JSON(http.StatusOK, map[string]bool{
						"legacy": env.Features.IsEnabled(ctx, featuremgmt.FlagPlaylistsRBAC),
						"openfeature": openfeature.NewDefaultClient().Boolean(ctx,
							featuremgmt.FlagPlaylistsRBAC, false, openfeature.TransactionContext(ctx)),
					})
				})
			},
		})
	}
	newClient := func(t *testing.T, env *apiserver.Environment) *http.Client {
		t.Helper()
		client, err := clientrest.HTTPClientFor(env.ClientConfig(apiserver.User{}))
		require.NoError(t, err)
		return client
	}
	check := func(t *testing.T, client *http.Client, enabled bool) {
		t.Helper()
		response, err := client.Get("http://grafana.test/api/test-feature-flags")
		require.NoError(t, err)
		body, err := io.ReadAll(response.Body)
		require.NoError(t, response.Body.Close())
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, response.StatusCode, "%s", body)
		require.JSONEq(t, fmt.Sprintf(`{"legacy":%t,"openfeature":%t}`, enabled, enabled), string(body))
	}
	reference := newClient(t, newEnvironment(t, false, false))
	for _, configured := range []bool{false, true} {
		for _, enabled := range []bool{false, true} {
			t.Run(fmt.Sprintf("configured=%t/enabled=%t", configured, enabled), func(t *testing.T) {
				t.Parallel()
				env := newEnvironment(t, enabled, configured)
				client := newClient(t, env)
				for range 10 {
					check(t, client, enabled)
					check(t, reference, false)
				}
				require.Equal(t, enabled, openfeature.NewDefaultClient().Boolean(env.Context(t.Context()),
					featuremgmt.FlagPlaylistsRBAC, false, openfeature.EvaluationContext{}))
			})
		}
	}
}
