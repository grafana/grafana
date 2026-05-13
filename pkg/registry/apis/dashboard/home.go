package dashboard

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashv1beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const HOME_DASHBOARD_NAME = "default-home-dashboard"

type homeDashboard struct{}

func (h *homeDashboard) Get(version string) (runtime.Object, error) {
	switch version {
	case dashv0.VERSION:
		return &dashv0.Dashboard{Spec: v0alpha1.Unstructured{
			Object: map[string]any{
				"title": "home/v0",
			},
		}}, nil
	case dashv1.VERSION:
		return &dashv1.Dashboard{Spec: v0alpha1.Unstructured{
			Object: map[string]any{
				"title": "home/v1",
			},
		}}, nil
	case dashv1beta1.VERSION:
		return &dashv1beta1.Dashboard{Spec: v0alpha1.Unstructured{
			Object: map[string]any{
				"title": "home/v1beta1",
			},
		}}, nil
	}

	return nil, fmt.Errorf("unsupported home dashboard version", "version", version)
}
