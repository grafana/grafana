package apis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer/yaml"
	yamlutil "k8s.io/apimachinery/pkg/util/yaml"

	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/datasources"
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

	Org1 OrgUsers // default
	OrgB OrgUsers // some other id

	// // Registered groups
	groups []metav1.APIGroup
}

func NewK8sTestHelper(t *testing.T, opts testinfra.GrafanaOpts) *K8sTestHelper {
	t.Helper()
	dir, path := testinfra.CreateGrafDir(t, opts)
	_, env := testinfra.StartGrafanaEnv(t, dir, path)

	c := &K8sTestHelper{
		env:        *env,
		t:          t,
		namespacer: request.GetNamespaceMapper(nil),
	}

	c.Org1 = c.createTestUsers("Org1")
	c.OrgB = c.createTestUsers("OrgB")

	c.loadAPIGroups()

	return c
}

func (c *K8sTestHelper) loadAPIGroups() {
	for {
		rsp := DoRequest(c, RequestParams{
			User: c.Org1.Viewer,
			Path: "/apis",
			// Accept: "application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json",
		}, &metav1.APIGroupList{})

		if rsp.Response.StatusCode == http.StatusOK {
			c.groups = rsp.Result.Groups
			return
		}

		time.Sleep(100 * time.Millisecond)
	}
}

func (c *K8sTestHelper) Shutdown() {
	err := c.env.Server.Shutdown(context.Background(), "done")
	require.NoError(c.t, err)
}

type ResourceClientArgs struct {
	User      User
	Namespace string
	GVR       schema.GroupVersionResource
}

type K8sResourceClient struct {
	t        *testing.T
	Args     ResourceClientArgs
	Resource dynamic.ResourceInterface
}

// This will set the expected Group/Version/Resource and return the discovery info if found
func (c *K8sTestHelper) GetResourceClient(args ResourceClientArgs) *K8sResourceClient {
	c.t.Helper()

	if args.Namespace == "" {
		args.Namespace = c.namespacer(args.User.Identity.GetOrgID())
	}

	client, err := dynamic.NewForConfig(args.User.NewRestConfig())
	require.NoError(c.t, err)

	return &K8sResourceClient{
		t:        c.t,
		Args:     args,
		Resource: client.Resource(args.GVR).Namespace(args.Namespace),
	}
}

// Cast the error to status error
func (c *K8sTestHelper) AsStatusError(err error) *errors.StatusError {
	c.t.Helper()

	if err == nil {
		return nil
	}

	//nolint:errorlint
	statusError, ok := err.(*errors.StatusError)
	require.True(c.t, ok)
	return statusError
}

// remove the meta keys that are expected to change each time
func (c *K8sResourceClient) SanitizeJSON(v *unstructured.Unstructured) string {
	c.t.Helper()

	deep := v.DeepCopy()
	anno := deep.GetAnnotations()
	if anno["grafana.app/originKey"] != "" {
		anno["grafana.app/originKey"] = "${originKey}"
	}
	if anno["grafana.app/updatedTimestamp"] != "" {
		anno["grafana.app/updatedTimestamp"] = "${updatedTimestamp}"
	}
	// Remove annotations that are not added by legacy storage
	delete(anno, "grafana.app/originTimestamp")
	delete(anno, "grafana.app/createdBy")
	delete(anno, "grafana.app/updatedBy")
	delete(anno, "grafana.app/action")

	deep.SetAnnotations(anno)
	copy := deep.Object
	meta, ok := copy["metadata"].(map[string]any)
	require.True(c.t, ok)

	replaceMeta := []string{"creationTimestamp", "resourceVersion", "uid"}
	for _, key := range replaceMeta {
		old, ok := meta[key]
		require.True(c.t, ok)
		require.NotEmpty(c.t, old)
		meta[key] = fmt.Sprintf("${%s}", key)
	}

	out, err := json.MarshalIndent(copy, "", "  ")
	//fmt.Printf("%s", out)
	require.NoError(c.t, err)
	return string(out)
}

type OrgUsers struct {
	Admin  User
	Editor User
	Viewer User
}

type User struct {
	Identity identity.Requester
	password string
	baseURL  string
}

func (c *User) NewRestConfig() *rest.Config {
	return &rest.Config{
		Host:     c.baseURL,
		Username: c.Identity.GetLogin(),
		Password: c.password,
	}
}

func (c *User) ResourceClient(t *testing.T, gvr schema.GroupVersionResource) dynamic.NamespaceableResourceInterface {
	client, err := dynamic.NewForConfig(c.NewRestConfig())
	require.NoError(t, err)
	return client.Resource(gvr)
}

func (c *User) RESTClient(t *testing.T, gv *schema.GroupVersion) *rest.RESTClient {
	cfg := dynamic.ConfigFor(c.NewRestConfig()) // adds negotiated serializers!
	cfg.GroupVersion = gv
	cfg.APIPath = "apis" // the plural
	client, err := rest.RESTClientFor(cfg)
	require.NoError(t, err)
	return client
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

	return DoRequest(c, RequestParams{
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

	return DoRequest(c, RequestParams{
		Method: http.MethodPut,
		Path:   path,
		User:   user,
		Body:   body,
	}, &AnyResource{})
}

func (c *K8sTestHelper) List(user User, namespace string, gvr schema.GroupVersionResource) AnyResourceListResponse {
	c.t.Helper()

	return DoRequest(c, RequestParams{
		User: user,
		Path: fmt.Sprintf("/apis/%s/%s/namespaces/%s/%s",
			gvr.Group,
			gvr.Version,
			namespace,
			gvr.Resource),
	}, &AnyResourceList{})
}

func DoRequest[T any](c *K8sTestHelper, params RequestParams, result *T) K8sResponse[T] {
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
	}
	return r
}

// Read local JSON or YAML file into a resource
func (c *K8sTestHelper) LoadYAMLOrJSONFile(fpath string) *unstructured.Unstructured {
	c.t.Helper()

	//nolint:gosec
	raw, err := os.ReadFile(fpath)
	require.NoError(c.t, err)
	require.NotEmpty(c.t, raw)
	return c.LoadYAMLOrJSON(string(raw))
}

// Read local JSON or YAML file into a resource
func (c *K8sTestHelper) LoadYAMLOrJSON(body string) *unstructured.Unstructured {
	c.t.Helper()

	decoder := yamlutil.NewYAMLOrJSONDecoder(bytes.NewReader([]byte(body)), 100)
	var rawObj runtime.RawExtension
	err := decoder.Decode(&rawObj)
	require.NoError(c.t, err)

	obj, _, err := yaml.NewDecodingSerializer(unstructured.UnstructuredJSONScheme).Decode(rawObj.Raw, nil, nil)
	require.NoError(c.t, err)
	unstructuredMap, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	require.NoError(c.t, err)

	return &unstructured.Unstructured{Object: unstructuredMap}
}

func (c K8sTestHelper) createTestUsers(orgName string) OrgUsers {
	c.t.Helper()

	store := c.env.SQLStore
	defer func() {
		c.env.Cfg.AutoAssignOrg = false
		c.env.Cfg.AutoAssignOrgId = 1 // the default
	}()

	quotaService := quotaimpl.ProvideService(store, c.env.Cfg)

	orgService, err := orgimpl.ProvideService(store, c.env.Cfg, quotaService)
	require.NoError(c.t, err)

	orgId := int64(1)
	if orgName != "Org1" {
		orgId, err = orgService.GetOrCreate(context.Background(), orgName)
		require.NoError(c.t, err)
	}
	c.env.Cfg.AutoAssignOrg = true
	c.env.Cfg.AutoAssignOrgId = int(orgId)

	teamSvc, err := teamimpl.ProvideService(store, c.env.Cfg)
	require.NoError(c.t, err)

	cache := localcache.ProvideService()
	userSvc, err := userimpl.ProvideService(store,
		orgService, c.env.Cfg, teamSvc, cache, quotaService,
		supportbundlestest.NewFakeBundleService())
	require.NoError(c.t, err)

	baseUrl := fmt.Sprintf("http://%s", c.env.Server.HTTPServer.Listener.Addr())
	createUser := func(key string, role org.RoleType) User {
		u, err := userSvc.Create(context.Background(), &user.CreateUserCommand{
			DefaultOrgRole: string(role),
			Password:       user.Password(key),
			Login:          fmt.Sprintf("%s-%d", key, orgId),
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
			baseURL:  baseUrl,
		}
	}
	return OrgUsers{
		Admin:  createUser("admin", org.RoleAdmin),
		Editor: createUser("editor", org.RoleEditor),
		Viewer: createUser("viewer", org.RoleViewer),
	}
}

func (c *K8sTestHelper) NewDiscoveryClient() *discovery.DiscoveryClient {
	c.t.Helper()

	baseUrl := fmt.Sprintf("http://%s", c.env.Server.HTTPServer.Listener.Addr())
	conf := &rest.Config{
		Host:     baseUrl,
		Username: c.Org1.Admin.Identity.GetLogin(),
		Password: c.Org1.Admin.password,
	}
	client, err := discovery.NewDiscoveryClientForConfig(conf)
	require.NoError(c.t, err)
	return client
}

func (c *K8sTestHelper) GetGroupVersionInfoJSON(group string) string {
	c.t.Helper()

	disco := c.NewDiscoveryClient()
	req := disco.RESTClient().Get().
		Prefix("apis").
		SetHeader("Accept", "application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json")

	result := req.Do(context.Background())
	require.NoError(c.t, result.Error())

	type DiscoItem struct {
		Metadata struct {
			Name string `json:"name"`
		} `json:"metadata"`
		Versions []any `json:"versions,omitempty"`
	}
	type DiscoList struct {
		Items []DiscoItem `json:"items"`
	}

	raw, err := result.Raw()
	require.NoError(c.t, err)
	all := &DiscoList{}
	err = json.Unmarshal(raw, all)
	require.NoError(c.t, err)

	for _, item := range all.Items {
		if item.Metadata.Name == group {
			v, err := json.MarshalIndent(item.Versions, "", "  ")
			require.NoError(c.t, err)
			return string(v)
		}
	}

	require.Fail(c.t, "could not find discovery info for: ", group)
	return ""
}

func (c *K8sTestHelper) CreateDS(cmd *datasources.AddDataSourceCommand) *datasources.DataSource {
	c.t.Helper()

	dataSource, err := c.env.Server.HTTPServer.DataSourcesService.AddDataSource(context.Background(), cmd)
	require.NoError(c.t, err)
	return dataSource
}
