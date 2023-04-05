package publicdashboard

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	"github.com/grafana/grafana/pkg/services/publicdashboards/validation"
)

var _ admission.ValidatingAdmissionController = (*pdValidation)(nil)

type pdValidation struct {
	publicdashboardsService publicdashboards.Service
	publicdashboardsStore   publicdashboards.Store
}

func ProvideValidation(
	publicdashboardsService publicdashboards.Service,
	publicdashboardsStore publicdashboards.Store,
) *pdValidation {
	return &pdValidation{
		publicdashboardsService: publicdashboardsService,
		publicdashboardsStore:   publicdashboardsStore,
	}
}

func (v *pdValidation) Validate(ctx context.Context, request *admission.AdmissionRequest) error {
	k8Dashboard := request.Object.(*PublicDashboard)
	pdModel, err := k8sObjectToModel(k8Dashboard)
	if err != nil {
		return err
	}

	// TODO should we ask k8s if the underlying dashboard exists?
	//dashboard, err := s.FindDashboard(ctx, u.OrgID, dto.DashboardUid)
	//if err != nil {
	//return nil, fmt.Errorf("Update: failed to find dashboard by orgId: %d and dashboardUid: %s: %w", u.OrgID, dto.DashboardUid, err)
	//}
	//if dashboard == nil {
	//return nil, fmt.Errorf("Update: dashboard not found by orgId: %d and dashboardUid: %s", u.OrgID, dto.DashboardUid)
	//}

	// API VALIDATIONS
	if !validation.IsValidShortUID(pdModel.DashboardUid) {
		return fmt.Errorf("invalid dashboard ID: %v", pdModel.DashboardUid)
	}

	// validate fields
	// TODO: make validatePublicDashboard take a PublicDashboard Model
	dto := &publicdashboardModels.SavePublicDashboardDTO{
		PublicDashboard: pdModel,
	}
	err = validation.ValidatePublicDashboard(dto)
	if err != nil {
		return err
	}

	return nil
}
