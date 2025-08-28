package apis

import (
	"bytes"
	"context"
	"encoding/json"
	goerrors "errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
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

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/configprovider"
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
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/userimpl"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/testinfra"
)

const (
	Org1 = "Org1"
	Org2 = "OrgB"
)

type K8sTestHelper struct {
	t          *testing.T
	env        server.TestEnv
	Namespacer request.NamespaceMapper

	Org1 OrgUsers // default
	OrgB OrgUsers // some other id

	// // Registered groups
	groups []metav1.APIGroup

	orgSvc  org.Service
	teamSvc team.Service
	userSvc user.Service
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

	cfgProvider, err := configprovider.ProvideService(c.env.Cfg)
	require.NoError(c.t, err)
	quotaService := quotaimpl.ProvideService(context.Background(), c.env.SQLStore, cfgProvider)
	orgSvc, err := orgimpl.ProvideService(c.env.SQLStore, c.env.Cfg, quotaService)
	require.NoError(c.t, err)
	c.orgSvc = orgSvc

	teamSvc, err := teamimpl.ProvideService(c.env.SQLStore, c.env.Cfg, tracing.NewNoopTracerService())
	require.NoError(c.t, err)
	c.teamSvc = teamSvc

	userSvc, err := userimpl.ProvideService(
		c.env.SQLStore, orgSvc, c.env.Cfg, teamSvc,
		localcache.ProvideService(), tracing.NewNoopTracerService(), quotaService,
		supportbundlestest.NewFakeBundleService())
	require.NoError(c.t, err)
	c.userSvc = userSvc

	_ = c.CreateOrg(Org1)
	_ = c.CreateOrg(Org2)

	c.Org1 = c.createTestUsers(Org1)
	c.OrgB = c.createTestUsers(Org2)

	c.loadAPIGroups()

	// ensure unified storage is alive and running
	ctx := identity.WithRequester(context.Background(), c.Org1.Admin.Identity)
	rsp, err := c.env.ResourceClient.IsHealthy(ctx, &resourcepb.HealthCheckRequest{})
	require.NoError(t, err, "unable to read resource client health check")
	require.Equal(t, resourcepb.HealthCheckResponse_SERVING, rsp.Status)

	return c
}

func (c *K8sTestHelper) loadAPIGroups() {
	for {
		rsp := DoRequest(c, RequestParams{
			User: c.Org1.Viewer,
			Path: "/apis",
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
	// Provide either a user or a service account token
	User                User
	ServiceAccountToken string
	Namespace           string
	GVR                 schema.GroupVersionResource
}

// Validate ensures that either User or ServiceAccountToken is provided, but not both
func (args ResourceClientArgs) Validate() error {
	if (args.User != User{}) && args.ServiceAccountToken != "" {
		return fmt.Errorf("cannot provide both User and ServiceAccountToken")
	}
	if (args.User == User{}) && args.ServiceAccountToken == "" {
		return fmt.Errorf("must provide either User or ServiceAccountToken")
	}
	return nil
}

type K8sResourceClient struct {
	t        *testing.T
	Args     ResourceClientArgs
	Resource dynamic.ResourceInterface
}

// newOptimizedRestConfigForTest creates a base rest.Config optimized for integration tests.
// It disables client-side rate limiting and uses an optimized HTTP transport.
func newOptimizedRestConfigForTest(host string) *rest.Config {
	return &rest.Config{
		Host: host,
		// For integration tests against a local server, client-side rate-limiting
		// is unnecessary and slows down tests. Setting QPS and Burst to high
		// values effectively disables the rate limiter.
		QPS:   -1,
		Burst: -1,
		// Use a shared transport optimized for high-concurrency testing
		// against a single host.
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 50, // Default is 2, which is too low for test concurrency.
		},
	}
}

// This will set the expected Group/Version/Resource and return the discovery info if found
func (c *K8sTestHelper) GetResourceClient(args ResourceClientArgs) *K8sResourceClient {
	c.t.Helper()

	// Validate that either User or ServiceAccountToken is provided, but not both
	err := args.Validate()
	require.NoError(c.t, err)

	if args.Namespace == "" {
		if args.User != (User{}) {
			args.Namespace = c.Namespacer(args.User.Identity.GetOrgID())
		} else {
			// For service account token, we need to pass the namespace directly
			require.NotEmpty(c.t, args.Namespace, "Namespace must be provided when using ServiceAccountToken")
		}
	}

	var client dynamic.Interface
	var clientErr error

	if args.User != (User{}) {
		client, clientErr = dynamic.NewForConfig(args.User.NewRestConfig())
	} else {
		// Use service account token for authentication
		cfg := newOptimizedRestConfigForTest(fmt.Sprintf("http://%s", c.env.Server.HTTPServer.Listener.Addr()))
		cfg.BearerToken = args.ServiceAccountToken
		client, clientErr = dynamic.NewForConfig(cfg)
	}
	require.NoError(c.t, clientErr)

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

func (c *K8sTestHelper) EnsureStatusError(err error, expectedHttpStatus int, expectedMessage string) {
	statusError := c.AsStatusError(err)
	require.NotNil(c.t, statusError)
	require.Equal(c.t, int32(expectedHttpStatus), statusError.ErrStatus.Code)
	if expectedMessage != "" {
		require.Equal(c.t, expectedMessage, statusError.ErrStatus.Message)
	}
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
		if key == "labels" {
			delete(meta, key)
			continue
		}

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

	// Separate standalone service accounts with different roles
	AdminServiceAccount       serviceaccounts.ServiceAccountDTO
	AdminServiceAccountToken  string
	EditorServiceAccount      serviceaccounts.ServiceAccountDTO
	EditorServiceAccountToken string
	ViewerServiceAccount      serviceaccounts.ServiceAccountDTO
	ViewerServiceAccountToken string

	// The team with admin+editor in it (but not viewer)
	Staff team.Team
}

type User struct {
	Identity identity.Requester
	password string
	baseURL  string
}

func (c *User) NewRestConfig() *rest.Config {
	cfg := newOptimizedRestConfigForTest(c.baseURL)
	cfg.Username = c.Identity.GetLogin()
	cfg.Password = c.password
	return cfg
}

// Implements: apiserver.RestConfigProvider
func (c *User) GetRestConfig(context.Context) (*rest.Config, error) {
	return c.NewRestConfig(), nil
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

type (
	AnyResourceResponse     = K8sResponse[AnyResource]
	AnyResourceListResponse = K8sResponse[AnyResourceList]
)

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
	client := &http.Client{
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	rsp, err := client.Do(req)
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
		Admin:  c.CreateUser("admin2", orgName, org.RoleAdmin, nil),
		Editor: c.CreateUser("editor", orgName, org.RoleEditor, nil),
		Viewer: c.CreateUser("viewer", orgName, org.RoleViewer, nil),
	}

	// Create service accounts
	users.AdminServiceAccount = c.CreateServiceAccount(users.Admin, "admin-sa", users.Admin.Identity.GetOrgID(), org.RoleAdmin)
	users.AdminServiceAccountToken = c.CreateServiceAccountToken(users.Admin, users.AdminServiceAccount.Id, users.Admin.Identity.GetOrgID(), "admin-token", 0)

	users.EditorServiceAccount = c.CreateServiceAccount(users.Admin, "editor-sa", users.Admin.Identity.GetOrgID(), org.RoleEditor)
	users.EditorServiceAccountToken = c.CreateServiceAccountToken(users.Admin, users.EditorServiceAccount.Id, users.Admin.Identity.GetOrgID(), "editor-token", 0)

	users.ViewerServiceAccount = c.CreateServiceAccount(users.Admin, "viewer-sa", users.Admin.Identity.GetOrgID(), org.RoleViewer)
	users.ViewerServiceAccountToken = c.CreateServiceAccountToken(users.Admin, users.ViewerServiceAccount.Id, users.Admin.Identity.GetOrgID(), "viewer-token", 0)

	users.Staff = c.CreateTeam("staff", "staff@"+orgName, users.Admin.Identity.GetOrgID())

	// Add Admin and Editor to Staff team as Admin and Member, respectively.
	c.AddOrUpdateTeamMember(users.Admin, users.Staff.ID, team.PermissionTypeAdmin)
	c.AddOrUpdateTeamMember(users.Editor, users.Staff.ID, team.PermissionTypeMember)

	return users
}

func (c *K8sTestHelper) CreateOrg(name string) int64 {
	if name == Org1 {
		return 1
	}

	oldAssing := c.env.Cfg.AutoAssignOrg
	defer func() {
		c.env.Cfg.AutoAssignOrg = oldAssing
	}()

	c.env.Cfg.AutoAssignOrg = false
	o, err := c.orgSvc.GetByName(context.Background(), &org.GetOrgByNameQuery{
		Name: name,
	})
	if goerrors.Is(err, org.ErrOrgNotFound) {
		id, err := c.orgSvc.GetOrCreate(context.Background(), name)
		require.NoError(c.t, err)
		return id
	}

	require.NoError(c.t, err)
	return o.ID
}

func (c *K8sTestHelper) CreateUser(name string, orgName string, basicRole org.RoleType, permissions []resourcepermissions.SetResourcePermissionCommand) User {
	c.t.Helper()

	orgId := c.CreateOrg(orgName)

	baseUrl := fmt.Sprintf("http://%s", c.env.Server.HTTPServer.Listener.Addr())

	// make org1 admins grafana admins
	isGrafanaAdmin := basicRole == identity.RoleAdmin && orgId == 1

	u, err := c.userSvc.Create(context.Background(), &user.CreateUserCommand{
		DefaultOrgRole: string(basicRole),
		Password:       user.Password(name),
		Login:          fmt.Sprintf("%s-%d", name, orgId),
		OrgID:          orgId,
		IsAdmin:        isGrafanaAdmin,
	})

	// for tests to work we need to add grafana admins to every org
	if isGrafanaAdmin {
		orgs, err := c.orgSvc.Search(context.Background(), &org.SearchOrgsQuery{})
		require.NoError(c.t, err)
		for _, o := range orgs {
			_ = c.orgSvc.AddOrgUser(context.Background(), &org.AddOrgUserCommand{
				Role:   identity.RoleAdmin,
				OrgID:  o.ID,
				UserID: u.ID,
			})
		}
	}

	require.NoError(c.t, err)
	require.Equal(c.t, orgId, u.OrgID)
	require.True(c.t, u.ID > 0)

	// should this always return a user with ID token?
	s, err := c.userSvc.GetSignedInUser(context.Background(), &user.GetSignedInUserQuery{
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
	teampermissionSvc, err := ossaccesscontrol.ProvideTeamPermissions(
		c.env.Cfg,
		c.env.FeatureToggles,
		c.env.Server.HTTPServer.RouteRegister,
		c.env.SQLStore,
		c.env.Server.HTTPServer.AccessControl,
		c.env.Server.HTTPServer.License,
		c.env.Server.HTTPServer.AlertNG.AccesscontrolService,
		c.teamSvc,
		c.userSvc,
		resourcepermissions.NewActionSetService(),
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
	cfg := newOptimizedRestConfigForTest(baseUrl)
	cfg.Username = c.Org1.Admin.Identity.GetLogin()
	cfg.Password = c.Org1.Admin.password
	client, err := discovery.NewDiscoveryClientForConfig(cfg)
	require.NoError(c.t, err)
	return client
}

func (c *K8sTestHelper) GetGroupVersionInfoJSON(group string) string {
	c.t.Helper()

	disco := c.NewDiscoveryClient()
	req := disco.RESTClient().Get().
		Prefix("apis").
		SetHeader("Accept", "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json")

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

	require.Failf(c.t, "could not find discovery info for: %s", group)
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

	teamCmd := team.CreateTeamCommand{
		Name:  name,
		Email: email,
		OrgID: orgID,
	}
	team, err := c.teamSvc.CreateTeam(context.Background(), &teamCmd)
	require.NoError(c.t, err)
	return team
}

// Compare the OpenAPI schema from one api against a cached snapshot
func VerifyOpenAPISnapshots(t *testing.T, dir string, gv schema.GroupVersion, h *K8sTestHelper) {
	if gv.Group == "" {
		return // skip invalid groups
	}
	path := fmt.Sprintf("/openapi/v3/apis/%s/%s", gv.Group, gv.Version)
	t.Run(path, func(t *testing.T) {
		rsp := DoRequest(h, RequestParams{
			Method: http.MethodGet,
			Path:   path,
			User:   h.Org1.Admin,
		}, &AnyResource{})

		require.NotNil(t, rsp.Response)
		require.Equal(t, 200, rsp.Response.StatusCode, path)

		var prettyJSON bytes.Buffer
		err := json.Indent(&prettyJSON, rsp.Body, "", "  ")
		require.NoError(t, err)
		pretty := prettyJSON.String()

		write := false
		fpath := filepath.Join(dir, fmt.Sprintf("%s-%s.json", gv.Group, gv.Version))

		// nolint:gosec
		// We can ignore the gosec G304 warning since this is a test and the function is only called with explicit paths
		body, err := os.ReadFile(fpath)
		if err == nil {
			if !assert.JSONEq(t, string(body), pretty) {
				t.Logf("openapi spec has changed: %s", path)
				t.Fail()
				write = true
			}
		} else {
			t.Errorf("missing openapi spec for: %s", path)
			write = true
		}

		if write {
			e2 := os.WriteFile(fpath, []byte(pretty), 0o644)
			if e2 != nil {
				t.Errorf("error writing file: %s", e2.Error())
			}
		}
	})
}

// CreateServiceAccount creates a service account with the specified name, organization, and role using the HTTP API
func (c *K8sTestHelper) CreateServiceAccount(executingUser User, name string, orgID int64, role org.RoleType) serviceaccounts.ServiceAccountDTO {
	c.t.Helper()

	saForm := struct {
		Name       string       `json:"name"`
		Role       org.RoleType `json:"role"`
		IsDisabled bool         `json:"isDisabled"`
	}{
		Name:       name,
		Role:       role,
		IsDisabled: false,
	}

	body, err := json.Marshal(saForm)
	require.NoError(c.t, err)

	resp := DoRequest(c, RequestParams{
		User:   executingUser,
		Method: http.MethodPost,
		Path:   "/api/serviceaccounts/",
		Body:   body,
	}, &serviceaccounts.ServiceAccountDTO{})

	require.Equal(c.t, http.StatusCreated, resp.Response.StatusCode, "failed to create service account, body: %s", string(resp.Body))
	require.NotNil(c.t, resp.Result, "failed to parse response body: %s", string(resp.Body))

	return *resp.Result
}

// CreateServiceAccountToken creates a token for the specified service account using the HTTP API
func (c *K8sTestHelper) CreateServiceAccountToken(user User, saID int64, orgID int64, tokenName string, secondsToLive int64) string {
	c.t.Helper()

	tokenCmd := struct {
		Name          string `json:"name"`
		SecondsToLive int64  `json:"secondsToLive"`
	}{
		Name:          tokenName,
		SecondsToLive: secondsToLive,
	}

	body, err := json.Marshal(tokenCmd)
	require.NoError(c.t, err)

	resp := DoRequest(c, RequestParams{
		User:   user,
		Method: http.MethodPost,
		Path:   fmt.Sprintf("/api/serviceaccounts/%d/tokens", saID),
		Body:   body,
	}, &struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
		Key  string `json:"key"`
	}{})

	require.Equal(c.t, http.StatusOK, resp.Response.StatusCode, "failed to create token, body: %s", string(resp.Body))
	require.NotNil(c.t, resp.Result, "failed to parse response body: %s", string(resp.Body))

	return resp.Result.Key
}

// DeleteServiceAccountToken deletes a token for the specified service account using the HTTP API
func (c *K8sTestHelper) DeleteServiceAccountToken(user User, orgID int64, saID int64, tokenID int64) {
	c.t.Helper()

	resp := DoRequest(c, RequestParams{
		User:   user,
		Method: http.MethodDelete,
		Path:   fmt.Sprintf("/api/serviceaccounts/%d/tokens/%d", saID, tokenID),
	}, &struct{}{})

	require.Equal(c.t, http.StatusOK, resp.Response.StatusCode, "failed to delete token, body: %s", string(resp.Body))
}

// DeleteServiceAccount deletes a service account for the specified organization and ID using the HTTP API
func (c *K8sTestHelper) DeleteServiceAccount(user User, orgID int64, saID int64) {
	c.t.Helper()

	resp := DoRequest(c, RequestParams{
		User:   user,
		Method: http.MethodDelete,
		Path:   fmt.Sprintf("/api/serviceaccounts/%d", saID),
	}, &struct{}{})

	require.Equal(c.t, http.StatusOK, resp.Response.StatusCode, "failed to delete service account, body: %s", string(resp.Body))
}

// Ensures that the passed error is an APIStatus error and fails the test if it is not.
func (c *K8sTestHelper) RequireApiErrorStatus(err error, reason metav1.StatusReason, httpCode int) metav1.Status {
	require.Error(c.t, err)
	status, ok := utils.ExtractApiErrorStatus(err)
	if !ok {
		c.t.Fatalf("Expected error to be an APIStatus, but got %T", err)
	}

	if reason != metav1.StatusReasonUnknown {
		require.Equal(c.t, status.Reason, reason)
	}

	if httpCode != 0 {
		require.Equal(c.t, status.Code, int32(httpCode))
	}

	return status
}
