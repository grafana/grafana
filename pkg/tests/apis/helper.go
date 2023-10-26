package apis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/yaml"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

type K8sTestHelper struct {
	t          *testing.T
	env        server.TestEnv
	namespacer request.NamespaceMapper

	Org1 OrgUsers
	Org2 OrgUsers

	// // Registered groups
	groups []metav1.APIGroup

	// Used to build the URL paths
	selectedGVR schema.GroupVersionResource
}

func NewK8sTestHelper(t *testing.T) *K8sTestHelper {
	t.Helper()
	dir, path := testinfra.CreateGrafDir(t, testinfra.GrafanaOpts{
		AppModeProduction: true, // do not start extra port 6443
		DisableAnonymous:  true,
		EnableFeatureToggles: []string{
			featuremgmt.FlagGrafanaAPIServer,
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
		},
	})

	_, env := testinfra.StartGrafanaEnv(t, dir, path)
	c := &K8sTestHelper{
		env:        *env,
		t:          t,
		namespacer: request.GetNamespaceMapper(nil),
	}

	c.Org1 = c.createTestUsers(int64(1))
	c.Org2 = c.createTestUsers(int64(2))

	// Read the API groups
	rsp := doRequest(c, RequestParams{
		User: c.Org1.Viewer,
		Path: "/apis",
		// Accept: "application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json",
	}, &metav1.APIGroupList{})
	c.groups = rsp.Result.Groups
	return c
}

type OrgUsers struct {
	Admin  User
	Editor User
	Viewer User
}

type User struct {
	Identity identity.Requester
	password string
}

type RequestParams struct {
	User        User
	Method      string // GET, POST, PATCH, etc
	Path        string
	Body        []byte
	ContentType string
	Accept      string
}

type K8sResponse[T any] struct {
	Response *http.Response
	Body     []byte
	Result   *T
	Status   *metav1.Status
}

type AnyResourceResponse = K8sResponse[AnyResource]
type AnyResourceListResponse = K8sResponse[AnyResourceList]

// This will set the expected Group/Version/Resource and return the discovery info if found
func (c *K8sTestHelper) SetGroupVersionResource(gvr schema.GroupVersionResource) {
	c.t.Helper()

	c.selectedGVR = gvr
}

func (c *K8sTestHelper) PostResource(user User, resource string, payload AnyResource) AnyResourceResponse {
	c.t.Helper()

	namespace := payload.Namespace
	if namespace == "" {
		namespace = c.namespacer(user.Identity.GetOrgID())
	}

	path := fmt.Sprintf("/apis/%s/namespaces/%s/%s",
		payload.APIVersion, namespace, resource)
	if payload.Name != "" {
		path = fmt.Sprintf("%s/%s", path, payload.Name)
	}

	body, err := json.Marshal(payload)
	require.NoError(c.t, err)

	return doRequest(c, RequestParams{
		Method: http.MethodPost,
		Path:   path,
		User:   user,
		Body:   body,
	}, &AnyResource{})
}

func (c *K8sTestHelper) PutResource(user User, resource string, payload AnyResource) AnyResourceResponse {
	c.t.Helper()

	path := fmt.Sprintf("/apis/%s/namespaces/%s/%s/%s",
		payload.APIVersion, payload.Namespace, resource, payload.Name)

	body, err := json.Marshal(payload)
	require.NoError(c.t, err)

	return doRequest(c, RequestParams{
		Method: http.MethodPut,
		Path:   path,
		User:   user,
		Body:   body,
	}, &AnyResource{})
}

func (c *K8sTestHelper) List(user User, namespace string) AnyResourceListResponse {
	c.t.Helper()

	return doRequest(c, RequestParams{
		User: user,
		Path: fmt.Sprintf("/apis/%s/%s/namespaces/%s/%s",
			c.selectedGVR.Group,
			c.selectedGVR.Version,
			namespace,
			c.selectedGVR.Resource),
	}, &AnyResourceList{})
}

func doRequest[T any](c *K8sTestHelper, params RequestParams, result *T) K8sResponse[T] {
	c.t.Helper()

	if params.Method == "" {
		params.Method = http.MethodGet
	}

	// Get the URL
	addr := c.env.Server.HTTPServer.Listener.Addr()
	baseUrl := fmt.Sprintf("http://%s", addr)
	login := params.User.Identity.GetLogin()
	if login != "" && params.User.password != "" {
		baseUrl = fmt.Sprintf("http://%s:%s@%s", login, params.User.password, addr)
	}

	contentType := params.ContentType
	var body io.Reader
	if params.Body != nil {
		body = bytes.NewReader(params.Body)
		if contentType == "" && json.Valid(params.Body) {
			contentType = "application/json"
		}
	}

	req, err := http.NewRequest(params.Method, fmt.Sprintf(
		"%s%s",
		baseUrl,
		params.Path,
	), body)
	require.NoError(c.t, err)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if params.Accept != "" {
		req.Header.Set("Accept", params.Accept)
	}
	rsp, err := http.DefaultClient.Do(req)
	require.NoError(c.t, err)

	r := K8sResponse[T]{
		Response: rsp,
		Result:   result,
	}
	defer func() {
		_ = rsp.Body.Close() // ignore any close errors
	}()
	r.Body, _ = io.ReadAll(rsp.Body)
	if json.Valid(r.Body) {
		_ = json.Unmarshal(r.Body, r.Result)

		s := &metav1.Status{}
		err := json.Unmarshal(r.Body, s)
		if err == nil && s.Kind == "Status" { // Usually an error!
			r.Status = s
			r.Result = nil
		}
	} else {
		_ = yaml.Unmarshal(r.Body, r.Result)
	}
	return r
}

func (c K8sTestHelper) createTestUsers(orgId int64) OrgUsers {
	c.t.Helper()

	store := c.env.SQLStore
	store.Cfg.AutoAssignOrg = true
	store.Cfg.AutoAssignOrgId = int(orgId)
	quotaService := quotaimpl.ProvideService(store, store.Cfg)

	orgService, err := orgimpl.ProvideService(store, store.Cfg, quotaService)
	require.NoError(c.t, err)

	gotID, err := orgService.GetOrCreate(context.Background(), fmt.Sprintf("Org%d", orgId))
	require.NoError(c.t, err)
	require.Equal(c.t, orgId, gotID)

	teamSvc := teamimpl.ProvideService(store, store.Cfg)
	cache := localcache.ProvideService()
	userSvc, err := userimpl.ProvideService(store,
		orgService, store.Cfg, teamSvc, cache, quotaService,
		supportbundlestest.NewFakeBundleService())
	require.NoError(c.t, err)

	createUser := func(key string, role org.RoleType) User {
		u, err := userSvc.Create(context.Background(), &user.CreateUserCommand{
			DefaultOrgRole: string(role),
			Password:       key,
			Login:          fmt.Sprintf("%s%d", key, orgId),
			OrgID:          orgId,
		})
		require.NoError(c.t, err)
		require.Equal(c.t, orgId, u.OrgID)
		require.True(c.t, u.ID > 0)

		s, err := userSvc.GetSignedInUser(context.Background(), &user.GetSignedInUserQuery{
			UserID: u.ID,
			Login:  u.Login,
			Email:  u.Email,
			OrgID:  orgId,
		})
		require.NoError(c.t, err)
		require.Equal(c.t, orgId, s.OrgID)
		require.Equal(c.t, role, s.OrgRole) // make sure the role was set properly
		return User{
			Identity: s,
			password: key,
		}
	}
	return OrgUsers{
		Admin:  createUser("admin", org.RoleAdmin),
		Editor: createUser("editor", org.RoleEditor),
		Viewer: createUser("viewer", org.RoleViewer),
	}
}

func (c K8sTestHelper) CreateDS(cmd *datasources.AddDataSourceCommand) *datasources.DataSource {
	c.t.Helper()

	dataSource, err := c.env.Server.HTTPServer.DataSourcesService.AddDataSource(context.Background(), cmd)
	require.NoError(c.t, err)
	return dataSource
}
