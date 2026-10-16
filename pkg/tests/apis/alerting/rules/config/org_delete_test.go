package config

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	unified "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationOrgDeletionCleansConfigInTargetOrg(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	helper := getTestHelper(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	seedSingleton(t, ctx, helper)
	targetNamespace := helper.Namespacer(helper.OrgB.OrgID)
	targetClient := newConfigClient(t, helper.OrgB.Admin)
	require.Eventually(t, func() bool {
		_, err := targetClient.Get(ctx, resource.Identifier{Namespace: targetNamespace, Name: model.ConfigSingletonName})
		return err == nil
	}, 30*time.Second, 200*time.Millisecond, "sync worker did not seed the target org Config")
	serviceCtx := identity.WithServiceIdentityContext(ctx, helper.OrgB.OrgID)
	key := &resourcepb.ResourceKey{Namespace: targetNamespace, Group: configGVR.Group, Resource: configGVR.Resource, Name: model.ConfigSingletonName}
	stored, err := helper.GetEnv().ResourceClient.Read(serviceCtx, &resourcepb.ReadRequest{Key: key})
	require.NoError(t, unified.ErrorFromResponse(stored.GetError(), err))

	response := apis.DoRequest(helper, apis.RequestParams{
		User:   helper.Org1.Admin,
		Method: http.MethodDelete,
		Path:   fmt.Sprintf("/api/orgs/%d", helper.OrgB.OrgID),
	}, &struct{}{})
	require.Equal(t, http.StatusOK, response.Response.StatusCode, string(response.Body))

	// The server admin remains in org 1, so this also exercises the service
	// identity's tenant switch through the real org deletion and API handlers.
	_, err = newConfigClient(t, helper.Org1.Admin).Get(ctx, singletonID)
	require.NoError(t, err, "deleting another org must preserve org 1's Config")
	stored, err = helper.GetEnv().ResourceClient.Read(serviceCtx, &resourcepb.ReadRequest{Key: key})
	readErr := unified.ErrorFromResponse(stored.GetError(), err)
	require.Error(t, readErr)
	result := unified.AsErrorResult(readErr)
	require.NotNil(t, result)
	require.Equal(t, int32(http.StatusNotFound), result.Code)
}
