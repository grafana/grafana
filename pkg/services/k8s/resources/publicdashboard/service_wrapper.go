package publicdashboard

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardStore "github.com/grafana/grafana/pkg/services/publicdashboards/database"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	publicdashboardService "github.com/grafana/grafana/pkg/services/publicdashboards/service"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// NOTE this is how you reset the CRD
//kubectl delete CustomResourceDefinition dashboards.dashboard.core.grafana.com

type ServiceWrapper struct {
	publicdashboards.Service
	store     publicdashboards.Store
	log       log.Logger
	clientset client.ClientSetProvider
	namespace string
}

var _ publicdashboards.Service = (*ServiceWrapper)(nil)

func ProvideService(
	publicDashboardService *publicdashboardService.PublicDashboardServiceImpl,
	publicDashboardStore *publicdashboardStore.PublicDashboardStoreImpl,
	clientset client.ClientSetProvider,
) (*ServiceWrapper, error) {
	return &ServiceWrapper{
		Service:   publicDashboardService,
		store:     publicDashboardStore,
		log:       log.New("k8s.publicdashboard.service-wrapper"),
		clientset: clientset,
		namespace: "default",
	}, nil
}

// Create saves the dashboard to kubernetes
func (s *ServiceWrapper) Create(ctx context.Context, u *user.SignedInUser, dto *publicdashboardModels.SavePublicDashboardDTO) (*publicdashboardModels.PublicDashboard, error) {
	// set params from DTO on model and use model from here down
	pd := dto.PublicDashboard
	pd.CreatedBy = u.UserID
	pd.DashboardUid = dto.DashboardUid
	pd.OrgId = u.OrgID

	// TODO this is mutation - investigate uid and whether we can do this in mutation hook
	uid := pd.Uid
	if uid == "" {
		uid = util.GenerateShortUID()
	}
	pd.Uid = uid

	// get resource client
	publicdashboardResource, err := s.clientset.GetClientset().GetResourceClient(CRD)
	if err != nil {
		return nil, fmt.Errorf("provideServiceWrapper failed to get public dashboard resource client: %w", err)
	}

	// convert from runtime object to core kind
	k8sModel, err := modelToK8sObject(s.namespace, pd)
	if err != nil {
		return nil, err
	}

	// convert from core kind to unstructured
	uObj, err := k8sObjectToUnstructured(k8sModel)
	if err != nil {
		return nil, err
	}

	// call k8s resource client
	uObj, err = publicdashboardResource.Create(ctx, uObj, metav1.CreateOptions{})
	if err != nil {
		return nil, publicdashboardModels.ErrBadRequest.Errorf("validation failed: %s", err)
	}

	rv := uObj.GetResourceVersion()
	s.log.Debug("wait for revision", "revision", rv)

	return pd, nil
}

// Delete removes the dashboard from kubernetes
func (s *ServiceWrapper) Delete(ctx context.Context, uid string) error {
	publicdashboardResource, err := s.clientset.GetClientset().GetResourceClient(CRD)
	if err != nil {
		return fmt.Errorf("provideServiceWrapper failed to get public dashboard resource client: %w", err)
	}

	return publicdashboardResource.Delete(ctx, uid, *metav1.NewDeleteOptions(0))
}
