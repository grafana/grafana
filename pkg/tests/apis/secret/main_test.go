package secret

import (
	"cmp"
	"context"
	"encoding/json"
	"math/rand/v2"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/registry/apis/secret"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

var (
	ResourceSecureValues = "secret.securevalues"
	ResourceKeepers      = "secret.keepers"

	ActionsAllKeepers = []string{
		secret.ActionSecretKeepersCreate,
		secret.ActionSecretKeepersWrite,
		secret.ActionSecretKeepersRead,
		secret.ActionSecretKeepersDelete,
	}
	ActionsAllSecureValues = []string{
		secret.ActionSecretSecureValuesCreate,
		secret.ActionSecretSecureValuesWrite,
		secret.ActionSecretSecureValuesRead,
		secret.ActionSecretSecureValuesDelete,
	}
)

type ResourcePermission struct {
	Actions []string
	Name    string // empty or "*" for all
}

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDiscoveryClient(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction: false, // required for experimental APIs
		EnableFeatureToggles: []string{
			// Required to start the example service
			featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs,
			featuremgmt.FlagSecretsManagementAppPlatform,
		},
	})

	t.Run("check discovery client", func(t *testing.T) {
		disco := helper.NewDiscoveryClient()

		resources, err := disco.ServerResourcesForGroupVersion("secret.grafana.app/v0alpha1")
		require.NoError(t, err)

		v1Disco, err := json.MarshalIndent(resources, "", "  ")
		require.NoError(t, err)

		var apiResourceList map[string]any
		require.NoError(t, json.Unmarshal(v1Disco, &apiResourceList))

		groupVersion, ok := apiResourceList["groupVersion"].(string)
		require.True(t, ok)
		require.Equal(t, "secret.grafana.app/v0alpha1", groupVersion)

		apiResources, ok := apiResourceList["resources"].([]any)
		require.True(t, ok)
		require.Len(t, apiResources, 2) // securevalue + keeper + (subresources...)
	})
}

func mustCreateUsersWithOrg(t *testing.T, helper *apis.K8sTestHelper, orgID int64, permissionMap map[string]ResourcePermission) apis.OrgUsers {
	t.Helper()

	permissions := make([]resourcepermissions.SetResourcePermissionCommand, 0, len(permissionMap))
	for resource, permission := range permissionMap {
		permissions = append(permissions, resourcepermissions.SetResourcePermissionCommand{
			Actions:           permission.Actions,
			Resource:          resource,
			ResourceAttribute: "uid",
			ResourceID:        cmp.Or(permission.Name, "*"),
		})
	}

	orgName := "org-" + strconv.FormatInt(orgID, 10)

	userSuffix := strconv.FormatInt(rand.Int64(), 10)

	// Add here admin or viewer if necessary.
	editor := helper.CreateUser("editor-"+userSuffix, orgName, org.RoleEditor, permissions)

	staff := helper.CreateTeam("staff-"+userSuffix, "staff-"+userSuffix+"@"+orgName, editor.Identity.GetOrgID())

	// Also call this method for each new user.
	helper.AddOrUpdateTeamMember(editor, staff.ID, team.PermissionTypeMember)

	return apis.OrgUsers{
		Editor: editor,
		Staff:  staff,
	}
}

func mustCreateUsers(t *testing.T, helper *apis.K8sTestHelper, permissionMap map[string]ResourcePermission) apis.OrgUsers {
	orgID := rand.Int64() + 2 // if it is 0, becomes 2 and not 1.
	return mustCreateUsersWithOrg(t, helper, orgID, permissionMap)
}

func mustGenerateSecureValue(t *testing.T, helper *apis.K8sTestHelper, user apis.User, keeperName ...string) *unstructured.Unstructured {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	secureValueClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: user,
		GVR:  gvrSecureValues,
	})

	testSecureValue := helper.LoadYAMLOrJSONFile("testdata/secure-value-default-generate.yaml")
	if len(keeperName) == 1 {
		testSecureValue.Object["spec"].(map[string]any)["keeper"] = keeperName[0]
	}

	raw, err := secureValueClient.Resource.Create(ctx, testSecureValue, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, raw)

	// Before returning, we need to wait for the outbox to process it, and the status.phase to be Succeeded.
	require.EventuallyWithT(t, func(collect *assert.CollectT) {
		result, err := secureValueClient.Resource.Get(ctx, raw.GetName(), metav1.GetOptions{})
		require.NoError(t, err)
		require.NotNil(t, result)

		status, ok := result.Object["status"].(map[string]any)
		require.True(t, ok)
		require.NotNil(t, status)

		statusPhase, ok := status["phase"].(string)
		require.True(t, ok)
		require.Equal(t, "Succeeded", statusPhase)
	}, 10*time.Second, 250*time.Millisecond, "expected status to be Suceeded")

	t.Cleanup(func() {
		require.NoError(t, secureValueClient.Resource.Delete(ctx, raw.GetName(), metav1.DeleteOptions{}))
	})

	return raw
}

func mustGenerateKeeper(t *testing.T, helper *apis.K8sTestHelper, user apis.User, specType map[string]any, testFile string) *unstructured.Unstructured {
	t.Helper()

	require.NotEmpty(t, testFile, "testFile must not be empty")

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	keeperClient := helper.GetResourceClient(apis.ResourceClientArgs{
		User: user,
		GVR:  gvrKeepers,
	})

	testKeeper := helper.LoadYAMLOrJSONFile(testFile)
	if specType != nil {
		testKeeper.Object["spec"] = specType
	}

	raw, err := keeperClient.Resource.Create(ctx, testKeeper, metav1.CreateOptions{})
	require.NoError(t, err)
	require.NotNil(t, raw)

	t.Cleanup(func() {
		require.NoError(t, keeperClient.Resource.Delete(ctx, raw.GetName(), metav1.DeleteOptions{}))
	})

	return raw
}
