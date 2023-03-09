package publicdashboard

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/kinds/publicdashboard"
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
	clientset *client.Clientset
	namespace string
}

var _ publicdashboards.Service = (*ServiceWrapper)(nil)

func ProvideService(
	publicDashboardService *publicdashboardService.PublicDashboardServiceImpl,
	publicDashboardStore *publicdashboardStore.PublicDashboardStoreImpl,
	clientset *client.Clientset,
) (*ServiceWrapper, error) {
	return &ServiceWrapper{
		Service:   publicDashboardService,
		store:     publicDashboardStore,
		log:       log.New("k8s.publicdashboard.service-wrapper"),
		clientset: clientset,
		namespace: "default",
	}, nil
}

// SaveDashboard saves the dashboard to kubernetes
func (s *ServiceWrapper) Create(ctx context.Context, u *user.SignedInUser, dto *publicdashboardModels.SavePublicDashboardDTO) (*publicdashboardModels.PublicDashboard, error) {
	// SERVICE MUTATION LOGIC
	// set default value for time settings
	if dto.PublicDashboard.TimeSettings == nil {
		dto.PublicDashboard.TimeSettings = &publicdashboardModels.TimeSettings{}
	}

	if dto.PublicDashboard.Share == "" {
		dto.PublicDashboard.Share = publicdashboardModels.PublicShareType
	}

	uid := dto.PublicDashboard.Uid
	if uid == "" {
		uid = util.GenerateShortUID()
	}
	accessToken, err := s.Service.NewPublicDashboardAccessToken(ctx)
	if err != nil {
		return nil, err
	}

	dto.PublicDashboard.Uid = uid
	dto.PublicDashboard.DashboardUid = dto.DashboardUid
	dto.PublicDashboard.OrgId = dto.OrgId
	dto.PublicDashboard.CreatedBy = dto.UserId
	dto.PublicDashboard.CreatedAt = time.Now()
	dto.PublicDashboard.AccessToken = accessToken

	// K8S LOGIC

	// get resource client
	publicdashboardResource, err := s.clientset.GetResourceClient(CRD)
	if err != nil {
		return nil, fmt.Errorf("provideServiceWrapper failed to get public dashboard resource client: %w", err)
	}
	// get annotations
	annotations, err := annotationsFromPublicDashboardDTO(dto)
	if err != nil {
		return nil, fmt.Errorf("error getting annotations from public dashboard dto: %s", err)
	}

	// convert DTO to k8s
	meta := metav1.ObjectMeta{
		Name:        dto.PublicDashboard.Uid,
		Namespace:   s.namespace,
		Annotations: annotations,
	}

	// create a publicdashboard kind object and assign values used in create
	pd := &publicdashboard.PublicDashboard{}
	pd.Uid = dto.PublicDashboard.Uid
	pd.DashboardUid = dto.DashboardUid
	pd.AccessToken = &dto.PublicDashboard.AccessToken
	pd.AnnotationsEnabled = dto.PublicDashboard.AnnotationsEnabled
	pd.TimeSelectionEnabled = dto.PublicDashboard.TimeSelectionEnabled
	pd.IsEnabled = dto.PublicDashboard.IsEnabled

	uObj, err := toUnstructured(pd, meta)
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

	return dto.PublicDashboard, nil
}

func annotationsFromPublicDashboardDTO(dto *publicdashboardModels.SavePublicDashboardDTO) (map[string]string, error) {
	ts, err := dto.PublicDashboard.TimeSettings.ToDB()
	if err != nil {
		return nil, nil
	}

	annotations := map[string]string{
		"orgID":        strconv.FormatInt(dto.OrgId, 10),
		"updatedBy":    strconv.FormatInt(dto.PublicDashboard.UpdatedBy, 10),
		"updatedAt":    strconv.FormatInt(dto.PublicDashboard.UpdatedAt.UnixNano(), 10),
		"createdBy":    strconv.FormatInt(dto.PublicDashboard.CreatedBy, 10),
		"createdAt":    strconv.FormatInt(dto.PublicDashboard.CreatedAt.UnixNano(), 10),
		"dashboardUID": dto.DashboardUid,
		"timeSettings": string(ts),
	}

	return annotations, nil
}
