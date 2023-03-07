package publicdashboard

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
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
	dto, err := k8sPublicDashboardToDTO(k8Dashboard)
	if err != nil {
		return err
	}

	// API VALIDATIONS
	if !validation.IsValidShortUID(dto.DashboardUid) {
		return fmt.Errorf("invalid dashboard ID: %v", dto.PublicDashboard.DashboardUid)
	}

	// SERVICE VALIDATIONS
	// NOTE - review this later. maybe shouldn't be checking dependency
	// ensure dashboard exists
	dashboard, err := v.publicdashboardsService.FindDashboard(ctx, dto.OrgId, dto.DashboardUid) // TODO: should dto.OrgId be coming from the user?
	if err != nil {
		return err
	}

	// validate fields
	err = validation.ValidatePublicDashboard(dto, dashboard)
	if err != nil {
		return err
	}

	// verify public dashboard does not exist and that we didn't get one from the
	// request
	existingPubdash, err := v.publicdashboardsStore.Find(ctx, dto.PublicDashboard.Uid)
	if err != nil {
		return fmt.Errorf("Create: failed to find the public dashboard: %w", err)
	} else if existingPubdash != nil {
		return fmt.Errorf("Create: public dashboard already exists: %s", dto.PublicDashboard.Uid)
	}
	return nil
}
