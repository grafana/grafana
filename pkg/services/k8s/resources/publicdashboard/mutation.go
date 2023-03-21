package publicdashboard

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
)

var _ admission.MutatingAdmissionController = (*pdMutation)(nil)

type pdMutation struct {
	publicdashboardsService publicdashboards.Service
	publicdashboardsStore   publicdashboards.Store
}

func ProvideMutation(
	publicdashboardsService publicdashboards.Service,
	publicdashboardsStore publicdashboards.Store,
) *pdMutation {
	return &pdMutation{
		publicdashboardsService: publicdashboardsService,
		publicdashboardsStore:   publicdashboardsStore,
	}
}

func (m *pdMutation) Mutate(ctx context.Context, request *admission.AdmissionRequest) (*admission.MutatingResponse, error) {
	resp := &admission.MutatingResponse{}

	// cast object to public dashboard model
	k8Dashboard := request.Object.(*PublicDashboard)
	pd, err := k8sObjectToModel(k8Dashboard)
	if err != nil {
		return nil, err
	}

	// do mutations
	if pd.TimeSettings == nil {
		pd.TimeSettings = &publicdashboardModels.TimeSettings{}
	}

	if pd.Share == "" {
		pd.Share = publicdashboardModels.PublicShareType
	}

	accessToken, err := m.publicdashboardsService.NewPublicDashboardAccessToken(ctx)
	if err != nil {
		return nil, err
	}
	pd.AccessToken = accessToken
	pd.CreatedAt = time.Now()

	// convert to runtime object
	uObj, err := modelToK8sObject(k8Dashboard.Namespace, pd)
	if err != nil {
		return nil, err
	}

	resp.Raw = uObj

	return resp, nil
}
