package publicdashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/k8s/client"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
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
	log       log.Logger
	clientset *client.Clientset
	namespace string
}

var _ publicdashboards.Service = (*ServiceWrapper)(nil)

func ProvideService(
	publicDashboardService *publicdashboardService.PublicDashboardServiceImpl,
	clientset *client.Clientset,
) (*ServiceWrapper, error) {
	return &ServiceWrapper{
		Service:   publicDashboardService,
		log:       log.New("k8s.publicdashboard.service-wrapper"),
		clientset: clientset,
		namespace: "default",
	}, nil
}

// SaveDashboard saves the dashboard to kubernetes
func (s *ServiceWrapper) Create(ctx context.Context, u *user.SignedInUser, dto *publicdashboardModels.SavePublicDashboardDTO) (*publicdashboardModels.PublicDashboard, error) {

	// get resource client
	publicdashboardResource, err := s.clientset.GetResourceClient(CRD)
	if err != nil {
		return nil, fmt.Errorf("ProvideServiceWrapper failed to get dashboard resource client: %w", err)
	}

	if dto.PublicDashboard.Uid != "" {
		return nil, fmt.Errorf("You cannot provide a uid when creating a public dashboard")
	}
	dto.PublicDashboard.Uid = util.GenerateShortUID()

	annotations, err := annotationsFromPublicDashboardDTO(dto)
	if err != nil {
		return nil, fmt.Errorf("Error getting annotations from public dashboard dto", err)
	}

	// convert DTO to k8s
	meta := metav1.ObjectMeta{
		Name:        dto.PublicDashboard.Uid,
		Namespace:   s.namespace,
		Annotations: annotations,
	}

	//if resourceVersion != "" {
	//meta.ResourceVersion = resourceVersion
	//}

	pubdashbytes, err := json.Marshal(dto.PublicDashboard)
	if err != nil {
		return nil, err
	}

	pd, _, err := Kind.JSONValueMux(pubdashbytes)
	if err != nil {
		return nil, fmt.Errorf("dashboard JSONValueMux failed: %w", err)
	}

	uObj, err := toUnstructured(pd, meta)
	if err != nil {
		return nil, err
	}

	// call k8s resource client
	uObj, err = publicdashboardResource.Create(ctx, uObj, metav1.CreateOptions{})

	if err != nil {
		return nil, err
	}

	rv := uObj.GetResourceVersion()
	s.log.Debug("wait for revision", "revision", rv)

	return nil, nil
}

func annotationsFromPublicDashboardDTO(dto *publicdashboardModels.SavePublicDashboardDTO) (map[string]string, error) {
	ts, err := dto.PublicDashboard.TimeSettings.ToDB()
	if err != nil {
		return nil, nil
	}

	annotations := map[string]string{
		"orgID":        strconv.FormatInt(dto.OrgId, 10),
		"userId":       strconv.FormatInt(dto.UserId, 10),
		"dashboardUID": dto.DashboardUid,
		"timeSettings": string(ts),
	}

	return annotations, nil
}
