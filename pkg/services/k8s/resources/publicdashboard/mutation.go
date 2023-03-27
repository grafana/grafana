package publicdashboard

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/k8s/admission"
	"github.com/grafana/grafana/pkg/services/publicdashboards"
	publicdashboardModels "github.com/grafana/grafana/pkg/services/publicdashboards/models"
	k8sAdmission "k8s.io/kubernetes/pkg/apis/admission"
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
	k8sPd, ok := request.Object.(*PublicDashboard)
	if !ok {
		return nil, fmt.Errorf("error casting obj to PublicDashboard")
	}
	pd, err := k8sObjectToModel(k8sPd)
	if err != nil {
		return nil, err
	}

	// all operations
	if pd.TimeSettings == nil {
		pd.TimeSettings = &publicdashboardModels.TimeSettings{}
	}

	// TODO find action names, refactor. switch feels wrong
	switch request.Action {
	case string(k8sAdmission.Create):
		err = m.create(ctx, k8sPd, pd)
	case string(k8sAdmission.Update):
		err = m.update(ctx, request, pd)

	// TODO handle other ops
	default:
	}

	if err != nil {
		return nil, err
	}

	// convert model into k8s object
	newk8s, err := modelToK8sObject(k8sPd.Namespace, pd)
	if err != nil {
		return nil, err
	}

	// apply object fields to existing k8s object so we keep the rest of the
	// metadata
	k8sPd.Spec = newk8s.Spec
	k8sPd.ObjectMeta.Annotations = newk8s.ObjectMeta.Annotations

	// add to response
	resp.Raw = k8sPd

	return resp, nil
}

func (m *pdMutation) create(ctx context.Context, k8sPd *PublicDashboard, pd *publicdashboardModels.PublicDashboard) error {
	// TODO how should we handle someone using kubectl to create a public
	// dashboard and not having a name/uid already?
	if pd.Uid == "" {
		pd.Uid = k8sPd.ObjectMeta.Name
	}

	if pd.Share == "" {
		pd.Share = publicdashboardModels.PublicShareType
	}

	accessToken, err := m.publicdashboardsService.NewPublicDashboardAccessToken(ctx)
	if err != nil {
		return err
	}
	pd.AccessToken = accessToken
	pd.CreatedAt = time.Now()
	return nil
}

func (m *pdMutation) update(ctx context.Context, request *admission.AdmissionRequest, pd *publicdashboardModels.PublicDashboard) error {
	oldK8sPd, ok := request.OldObject.(*PublicDashboard)
	if !ok {
		return fmt.Errorf("error casting old obj to PublicDashboard")
	}

	oldPd, err := k8sObjectToModel(oldK8sPd)
	if err != nil {
		return err
	}

	if pd.Share == "" {
		pd.Share = oldPd.Share
	}

	return nil
}
