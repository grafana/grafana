package api

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	domain "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/web"
	"github.com/stretchr/testify/require"
)

func TestProvisioningApi(t *testing.T) {
	t.Run("successful GET policies returns 200", func(t *testing.T) {
		sut := createProvisioningSrvSut()
		rc := createTestRequestCtx()

		response := sut.RouteGetPolicyTree(&rc)

		require.Equal(t, 200, response.Status())
	})

	t.Run("successful POST policies returns 202", func(t *testing.T) {
		sut := createProvisioningSrvSut()
		rc := createTestRequestCtx()
		tree := apimodels.Route{}

		response := sut.RoutePostPolicyTree(&rc, tree)

		require.Equal(t, 202, response.Status())
	})

	// TODO: we have not lifted out validation yet. Test that we are returning errors properly once validation has been lifted.

	t.Run("when org has no AM config", func(t *testing.T) {
		t.Run("GET policies returns 404", func(t *testing.T) {
			sut := createProvisioningSrvSut()
			rc := createTestRequestCtx()
			rc.SignedInUser.OrgId = 2

			response := sut.RouteGetPolicyTree(&rc)

			require.Equal(t, 404, response.Status())
		})

		t.Run("POST policies returns 404", func(t *testing.T) {
			sut := createProvisioningSrvSut()
			rc := createTestRequestCtx()
			rc.SignedInUser.OrgId = 2

			response := sut.RouteGetPolicyTree(&rc)

			require.Equal(t, 404, response.Status())
		})
	})

	t.Run("when an unspecified error occurrs", func(t *testing.T) {
		t.Run("GET policies returns 500", func(t *testing.T) {
			sut := createProvisioningSrvSut()
			sut.policies = &fakeFailingNotificationPolicyService{}
			rc := createTestRequestCtx()

			response := sut.RouteGetPolicyTree(&rc)

			require.Equal(t, 500, response.Status())
			require.NotEmpty(t, response.Body())
			require.Contains(t, string(response.Body()), "something went wrong")
		})

		t.Run("POST policies returns 500", func(t *testing.T) {
			sut := createProvisioningSrvSut()
			sut.policies = &fakeFailingNotificationPolicyService{}
			rc := createTestRequestCtx()
			tree := apimodels.Route{}

			response := sut.RoutePostPolicyTree(&rc, tree)

			require.Equal(t, 500, response.Status())
			require.NotEmpty(t, response.Body())
			require.Contains(t, string(response.Body()), "something went wrong")
		})
	})
}

func createProvisioningSrvSut() ProvisioningSrv {
	return ProvisioningSrv{
		log:      log.NewNopLogger(),
		policies: newFakeNotificationPolicyService(),
	}
}

func createTestRequestCtx() models.ReqContext {
	return models.ReqContext{
		Context: &web.Context{
			Req: &http.Request{},
		},
		SignedInUser: &models.SignedInUser{
			OrgId: 1,
		},
	}
}

type fakeNotificationPolicyService struct {
	tree apimodels.Route
	prov domain.Provenance
}

func newFakeNotificationPolicyService() *fakeNotificationPolicyService {
	return &fakeNotificationPolicyService{
		tree: apimodels.Route{
			Receiver: "some-receiver",
		},
		prov: domain.ProvenanceNone,
	}
}

func (f *fakeNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (provisioning.EmbeddedRoutingTree, error) {
	if orgID != 1 {
		return provisioning.EmbeddedRoutingTree{}, store.ErrNoAlertmanagerConfiguration
	}
	return provisioning.EmbeddedRoutingTree{
		Route:      f.tree,
		Provenance: f.prov,
	}, nil
}

func (f *fakeNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree apimodels.Route, p domain.Provenance) error {
	if orgID != 1 {
		return store.ErrNoAlertmanagerConfiguration
	}
	f.tree = tree
	f.prov = p
	return nil
}

type fakeFailingNotificationPolicyService struct{}

func (f *fakeFailingNotificationPolicyService) GetPolicyTree(ctx context.Context, orgID int64) (provisioning.EmbeddedRoutingTree, error) {
	return provisioning.EmbeddedRoutingTree{}, fmt.Errorf("something went wrong")
}

func (f *fakeFailingNotificationPolicyService) UpdatePolicyTree(ctx context.Context, orgID int64, tree apimodels.Route, p domain.Provenance) error {
	return fmt.Errorf("something went wrong")
}
