package dashboards

import (
	"context"
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

// NOTE this is how you reset the CRD
//kubectl delete CustomResourceDefinition dashboards.dashboard.core.grafana.com

type Service struct {
	dashboards.DashboardService

	cfg *setting.Cfg
	log log.Logger

	dashboardResource *Resource
}

var _ dashboards.DashboardService = (*Service)(nil)

func ProvideService(
	cfg *setting.Cfg,
	dashboardResource *Resource,
) *Service {
	return &Service{
		cfg:               cfg,
		log:               log.New("k8s.dashboards.service"),
		dashboardResource: dashboardResource,
	}
}

func (s *Service) WithDashboardService(dashboardService dashboards.DashboardService) *Service {
	s.DashboardService = dashboardService
	return s
}

// SaveDashboard saves the dashboard to kubernetes
func (s *Service) SaveDashboard(ctx context.Context, dto *dashboards.SaveDashboardDTO, allowUiUpdate bool) (*dashboards.Dashboard, error) {
	// config and client setup
	namespace := "default"
	// take the kindsys dashboard kind and alias it so it's easier to distinguish from dashboards.Dashboard
	type dashboardKind = dashboard.Dashboard
	// get the dashboard CRD from the CRD registry
	dashboardCRD := s.dashboardResource.crd

	/////////////////
	// do  work

	updateDashboard := false
	resourceVersion := ""

	// FIXME this is not reliable and is spaghetti
	var err error
	uid := dto.Dashboard.UID
	if uid == "" {
		uid = util.GenerateShortUID()
	} else {
		// check if dashboard exists in k8s. if it does, we're gonna do an update, if
		rv, ok, err := getResourceVersion(ctx, s.dashboardResource, uid)
		if !ok {
			return nil, err
		}

		if rv != "" {
			// exists in k8s
			updateDashboard = true
			resourceVersion = rv
		}
	}

	if dto.Dashboard.Data == nil {
		return nil, fmt.Errorf("dashboard data is nil")
	}

	// HACK, remove empty ID!!
	dto.Dashboard.Data.Del("id")
	dto.Dashboard.Data.Set("uid", uid)
	dto.Dashboard.UID = uid
	// strip nulls...
	stripNulls(dto.Dashboard.Data)

	dashbytes, err := dto.Dashboard.Data.MarshalJSON()
	if err != nil {
		return nil, err
	}

	d, _, err := s.dashboardResource.kind.JSONValueMux(dashbytes)
	if err != nil {
		return nil, fmt.Errorf("dashboard JSONValueMux failed: %w", err)
	}

	if d.Uid == nil {
		d.Uid = &uid
	}

	if d.Title == nil {
		d.Title = &dto.Dashboard.Title
	}

	b := k8ssys.Base[dashboardKind]{
		TypeMeta: metav1.TypeMeta{
			Kind:       dashboardCRD.GVK().Kind,
			APIVersion: dashboardCRD.GVK().Group + "/" + dashboardCRD.GVK().Version,
		},
		ObjectMeta: metav1.ObjectMeta{
			Namespace:   namespace,
			Name:        GrafanaUIDToK8sName(uid),
			Annotations: annotationsFromDashboardDTO(dto),
		},
		Spec: *d,
	}

	if resourceVersion != "" {
		b.ObjectMeta.ResourceVersion = resourceVersion
	}

	o, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&b)
	if err != nil {
		return nil, err
	}

	uObj := &unstructured.Unstructured{
		Object: o,
	}

	if updateDashboard {
		s.log.Debug("k8s action: update")
		uObj, err = s.dashboardResource.Update(ctx, uObj, metav1.UpdateOptions{})
	} else {
		s.log.Debug("k8s action: create")
		uObj, err = s.dashboardResource.Create(ctx, uObj, metav1.CreateOptions{})
	}

	// create or update error
	if err != nil {
		return nil, err
	}

	rv := uObj.GetResourceVersion()
	s.log.Debug("wait for revision", "revision", rv)

	for i := 0; i < 5; i++ {
		time.Sleep(150 * time.Millisecond)
		out, err := s.DashboardService.GetDashboard(ctx, &dashboards.GetDashboardQuery{UID: uid, OrgID: dto.OrgID})
		if err != nil {
			fmt.Printf("ERROR: %v", err)
			continue
		}
		if out != nil && out.Data != nil {
			savedRV := out.Data.Get("resourceVersion").MustString()
			if savedRV == rv {
				return out, nil
			} else {
				fmt.Printf("NO MATCH: %v\n", out)
			}
		}
	}

	return nil, fmt.Errorf("controller never ran?")
}
