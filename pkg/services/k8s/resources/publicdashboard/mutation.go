package publicdashboard

import (
	"context"

	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
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

	// reverse this
	//k8Dashboard := request.Object.(*PublicDashboard)
	//pdModel, err := k8sPublicDashboardToDTO(k8Dashboard)
	//if err != nil {
	//return err
	//}

	return nil, nil
}
