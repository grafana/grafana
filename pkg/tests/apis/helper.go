package apis

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer/yaml"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/version"
	yamlutil "k8s.io/apimachinery/pkg/util/yaml"
	apimachineryversion "k8s.io/apimachinery/pkg/version"
	"k8s.io/client-go/discovery"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/ossaccesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/apiserver/options"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgimpl"
	"github.com/grafana/grafana/pkg/services/quota/quotaimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

const Org1 = "Org1"

type K8sTestHelper struct {
	t          *testing.T
	env        server.TestEnv
	Namespacer request.NamespaceMapper

	Org1 OrgUsers // default
	OrgB OrgUsers // some other id

	// // Registered groups
	groups []metav1.APIGroup
}

func NewK8sTestHelper(t *testing.T, opts testinfra.GrafanaOpts) *K8sTestHelper {
	t.Helper()

	// Use GRPC server when not configured
	if opts.APIServerStorageType == "" && opts.GRPCServerAddress == "" {
		// TODO, this really should be gRPC, but sometimes fails in drone
		// the two *should* be identical, but we have seen issues when using real gRPC vs channel
		opts.APIServerStorageType = options.StorageTypeUnified // TODO, should be GRPC
	}

	// Always enable `FlagAppPlatformGrpcClientAuth` for k8s integration tests, as this is the desired behavior.
	// The flag only exists to support the transition from the old to the new behavior in dev/ops/prod.
	opts.EnableFeatureToggles = append(opts.EnableFeatureToggles, featuremgmt.FlagAppPlatformGrpcClientAuth)
	dir, path := testinfra.CreateGrafDir(t, opts)
	_, env := testinfra.StartGrafanaEnv(t, dir, path)

	c := &K8sTestHelper{
		env:        *env,
		t:          t,
		Namespacer: request.GetNamespaceMapper(nil),
	}

	c.Org1 = c.createTestUsers(Org1)
	c.OrgB = c.createTestUsers("OrgB")

	c.loadAPIGroups()

	// ensure unified storage is alive and running
	ctx := identity.WithRequester(context.Background(), c.Org1.Admin.Identity)
	rsp, err := c.env.ResourceClient.IsHealthy(ctx, &resource.HealthCheckRequest{})
	require.NoError(t, err, "unable to read resource client health check")
	require.Equal(t, resource.HealthCheckResponse_SERVING, rsp.Status)

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

func (c *K8sTestHelper) GetEnv() server.TestEnv {
	return c.env
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
		args.Namespace = c.Namespacer(args.User.Identity.GetOrgID())
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

func (c *K8sResourceClient) SanitizeJSONList(v *unstructured.UnstructuredList, replaceMeta ...string) string {
	c.t.Helper()

	clean := &unstructured.UnstructuredList{}
	for _, item := range v.Items {
		copy := c.sanitizeObject(&item, replaceMeta...)
		clean.Items = append(clean.Items, *copy)
	}

	out, err := json.MarshalIndent(clean, "", "  ")
	require.NoError(c.t, err)
	return string(out)
}

func (c *K8sResourceClient) SpecJSON(v *unstructured.UnstructuredList) string {
	c.t.Helper()

	clean := []any{}
	for _, item := range v.Items {
		clean = append(clean, item.Object["spec"])
	}

	out, err := json.MarshalIndent(clean, "", "  ")
	require.NoError(c.t, err)
	return string(out)
}

// remove the meta keys that are expected to change each time
func (c *K8sResourceClient) SanitizeJSON(v *unstructured.Unstructured, replaceMeta ...string) string {
	c.t.Helper()
	copy := c.sanitizeObject(v, replaceMeta...)

	out, err := json.MarshalIndent(copy, "", "  ")
	require.NoError(c.t, err)
	return string(out)
}

// remove the meta keys that are expected to change each time
func (c *K8sResourceClient) sanitizeObject(v *unstructured.Unstructured, replaceMeta ...string) *unstructured.Unstructured {
	c.t.Helper()

	deep := v.DeepCopy()
	deep.SetAnnotations(nil)
	deep.SetManagedFields(nil)
	copy := deep.Object
	meta, ok := copy["metadata"].(map[string]any)
	require.True(c.t, ok)

	// remove generation
	delete(meta, "generation")

	replaceMeta = append(replaceMeta, "creationTimestamp", "resourceVersion", "uid")
	for _, key := range replaceMeta {
		old, ok := meta[key]
		if ok {
			require.NotEmpty(c.t, old)
			meta[key] = fmt.Sprintf("${%s}", key)
		}
	}
	deep.Object["metadata"] = meta
	return deep
}

type OrgUsers struct {
	Admin  User
	Editor User
	Viewer User

	// The team with admin+editor in it (but not viewer)
	Staff team.Team
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
		namespace = c.Namespacer(user.Identity.GetOrgID())
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
	return c.LoadYAMLOrJSON(string(c.LoadFile(fpath)))
}

// Read local file into a byte slice. Does not need to be a resource.
func (c *K8sTestHelper) LoadFile(fpath string) []byte {
	c.t.Helper()

	//nolint:gosec
	raw, err := os.ReadFile(fpath)
	require.NoError(c.t, err)
	require.NotEmpty(c.t, raw)
	return raw
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

func (c *K8sTestHelper) createTestUsers(orgName string) OrgUsers {
	c.t.Helper()
	users := OrgUsers{
		Admin:  c.CreateUser("admin", orgName, org.RoleAdmin, nil),
		Editor: c.CreateUser("editor", orgName, org.RoleEditor, nil),
		Viewer: c.CreateUser("viewer", orgName, org.RoleViewer, nil),
	}
	users.Staff = c.CreateTeam("staff", "staff@"+orgName, users.Admin.Identity.GetOrgID())

	// Add Admin and Editor to Staff team as Admin and Member, respectively.
	c.AddOrUpdateTeamMember(users.Admin, users.Staff.ID, team.PermissionTypeAdmin)
	c.AddOrUpdateTeamMember(users.Editor, users.Staff.ID, team.PermissionTypeMember)

	return users
}

func (c *K8sTestHelper) CreateUser(name string, orgName string, basicRole org.RoleType, permissions []resourcepermissions.SetResourcePermissionCommand) User {
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
	if orgName != Org1 {
		o, err := orgService.GetByName(context.Background(), &org.GetOrgByNameQuery{Name: orgName})
		if err != nil {
			if !org.ErrOrgNotFound.Is(err) {
				require.NoError(c.t, err)
			}
			orgId, err = orgService.GetOrCreate(context.Background(), orgName)
			require.NoError(c.t, err)
		} else {
			orgId = o.ID
		}
	}
	c.env.Cfg.AutoAssignOrg = true
	c.env.Cfg.AutoAssignOrgId = int(orgId)

	teamSvc, err := teamimpl.ProvideService(store, c.env.Cfg, tracing.InitializeTracerForTest())
	require.NoError(c.t, err)

	cache := localcache.ProvideService()
	userSvc, err := userimpl.ProvideService(
		store, orgService, c.env.Cfg, teamSvc,
		cache, tracing.InitializeTracerForTest(), quotaService,
		supportbundlestest.NewFakeBundleService())
	require.NoError(c.t, err)

	baseUrl := fmt.Sprintf("http://%s", c.env.Server.HTTPServer.Listener.Addr())

	u, err := userSvc.Create(context.Background(), &user.CreateUserCommand{
		DefaultOrgRole: string(basicRole),
		Password:       user.Password(name),
		Login:          fmt.Sprintf("%s-%d", name, orgId),
		OrgID:          orgId,
		IsAdmin:        basicRole == identity.RoleAdmin && orgId == 1, // make org1 admins grafana admins
	})
	require.NoError(c.t, err)
	require.Equal(c.t, orgId, u.OrgID)
	require.True(c.t, u.ID > 0)

	// should this always return a user with ID token?
	s, err := userSvc.GetSignedInUser(context.Background(), &user.GetSignedInUserQuery{
		UserID: u.ID,
		Login:  u.Login,
		Email:  u.Email,
		OrgID:  orgId,
	})
	require.NoError(c.t, err)
	require.Equal(c.t, orgId, s.OrgID)
	require.Equal(c.t, basicRole, s.OrgRole) // make sure the role was set properly

	idToken, idClaims, err := c.env.IDService.SignIdentity(context.Background(), s)
	require.NoError(c.t, err)
	s.IDToken = idToken
	s.IDTokenClaims = idClaims

	usr := User{
		Identity: s,
		password: name,
		baseURL:  baseUrl,
	}

	if len(permissions) > 0 {
		c.SetPermissions(usr, permissions)
	}

	return usr
}

func (c *K8sTestHelper) SetPermissions(user User, permissions []resourcepermissions.SetResourcePermissionCommand) {
	// nolint:staticcheck
	id, err := user.Identity.GetInternalID()
	require.NoError(c.t, err)

	permissionsStore := resourcepermissions.NewStore(c.env.Cfg, c.env.SQLStore, featuremgmt.WithFeatures())

	for _, permission := range permissions {
		_, err := permissionsStore.SetUserResourcePermission(context.Background(),
			user.Identity.GetOrgID(),
			accesscontrol.User{ID: id},
			permission, nil)
		require.NoError(c.t, err)
	}
}

func (c *K8sTestHelper) AddOrUpdateTeamMember(user User, teamID int64, permission team.PermissionType) {
	teamSvc, err := teamimpl.ProvideService(c.env.SQLStore, c.env.Cfg, tracing.InitializeTracerForTest())
	require.NoError(c.t, err)

	orgService, err := orgimpl.ProvideService(c.env.SQLStore, c.env.Cfg, c.env.Server.HTTPServer.QuotaService)
	require.NoError(c.t, err)

	cache := localcache.ProvideService()
	userSvc, err := userimpl.ProvideService(
		c.env.SQLStore, orgService, c.env.Cfg, teamSvc,
		cache, tracing.InitializeTracerForTest(), c.env.Server.HTTPServer.QuotaService,
		supportbundlestest.NewFakeBundleService())
	require.NoError(c.t, err)

	teampermissionSvc, err := ossaccesscontrol.ProvideTeamPermissions(
		c.env.Cfg,
		c.env.FeatureToggles,
		c.env.Server.HTTPServer.RouteRegister,
		c.env.SQLStore,
		c.env.Server.HTTPServer.AccessControl,
		c.env.Server.HTTPServer.License,
		c.env.Server.HTTPServer.AlertNG.AccesscontrolService,
		teamSvc,
		userSvc,
		resourcepermissions.NewActionSetService(c.env.FeatureToggles),
	)
	require.NoError(c.t, err)

	id, err := user.Identity.GetInternalID()
	require.NoError(c.t, err)

	teamIDString := strconv.FormatInt(teamID, 10)
	_, err = teampermissionSvc.SetUserPermission(context.Background(), user.Identity.GetOrgID(), accesscontrol.User{ID: id}, teamIDString, permission.String())
	require.NoError(c.t, err)
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

func (c *K8sTestHelper) GetVersionInfo() apimachineryversion.Info {
	c.t.Helper()

	disco := c.NewDiscoveryClient()
	req := disco.RESTClient().Get().
		Prefix("version").
		SetHeader("Accept", "application/json")

	result := req.Do(context.Background())
	require.NoError(c.t, result.Error())

	raw, err := result.Raw()
	require.NoError(c.t, err)
	info := apimachineryversion.Info{}
	err = json.Unmarshal(raw, &info)
	require.NoError(c.t, err)

	// Make sure the gitVersion is parsable
	v, err := version.Parse(info.GitVersion)
	require.NoError(c.t, err)
	require.Equal(c.t, info.Major, fmt.Sprintf("%d", v.Major()))
	require.Equal(c.t, info.Minor, fmt.Sprintf("%d", v.Minor()))
	return info
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

func (c *K8sTestHelper) CreateTeam(name, email string, orgID int64) team.Team {
	c.t.Helper()

	team, err := c.env.Server.HTTPServer.TeamService.CreateTeam(context.Background(), name, email, orgID)
	require.NoError(c.t, err)
	return team
}

// TypedClient is the struct that implements a typed interface for resource operations
type TypedClient[T any, L any] struct {
	Client dynamic.ResourceInterface
}

func (c *TypedClient[T, L]) Create(ctx context.Context, resource *T, opts metav1.CreateOptions) (*T, error) {
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(resource)
	if err != nil {
		return nil, err
	}
	u := &unstructured.Unstructured{Object: unstructuredObj}
	result, err := c.Client.Create(ctx, u, opts)
	if err != nil {
		return nil, err
	}
	createdObj := new(T)
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, createdObj)
	if err != nil {
		return nil, err
	}
	return createdObj, nil
}

func (c *TypedClient[T, L]) Update(ctx context.Context, resource *T, opts metav1.UpdateOptions) (*T, error) {
	unstructuredObj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(resource)
	if err != nil {
		return nil, err
	}
	u := &unstructured.Unstructured{Object: unstructuredObj}
	result, err := c.Client.Update(ctx, u, opts)
	if err != nil {
		return nil, err
	}
	updatedObj := new(T)
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, updatedObj)
	if err != nil {
		return nil, err
	}
	return updatedObj, nil
}

func (c *TypedClient[T, L]) Delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	return c.Client.Delete(ctx, name, opts)
}

func (c *TypedClient[T, L]) Get(ctx context.Context, name string, opts metav1.GetOptions) (*T, error) {
	result, err := c.Client.Get(ctx, name, opts)
	if err != nil {
		return nil, err
	}
	retrievedObj := new(T)
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, retrievedObj)
	if err != nil {
		return nil, err
	}
	return retrievedObj, nil
}

func (c *TypedClient[T, L]) List(ctx context.Context, opts metav1.ListOptions) (*L, error) {
	result, err := c.Client.List(ctx, opts)
	if err != nil {
		return nil, err
	}
	listObj := new(L)
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.UnstructuredContent(), listObj)
	if err != nil {
		return nil, err
	}
	return listObj, nil
}

func (c *TypedClient[T, L]) Patch(ctx context.Context, name string, pt types.PatchType, data []byte, opts metav1.PatchOptions, subresources ...string) (*T, error) {
	result, err := c.Client.Patch(ctx, name, pt, data, opts, subresources...)
	if err != nil {
		return nil, err
	}
	patchedObj := new(T)
	err = runtime.DefaultUnstructuredConverter.FromUnstructured(result.Object, patchedObj)
	if err != nil {
		return nil, err
	}
	return patchedObj, nil
}
