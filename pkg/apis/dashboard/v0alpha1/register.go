package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "dashboard.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var DashboardResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"dashboards", "dashboard", "Dashboard",
	func() runtime.Object { return &Dashboard{} },
	func() runtime.Object { return &DashboardList{} },
)

var DashboardSummaryResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"summary", "summary", "DashboardSummary",
	func() runtime.Object { return &DashboardSummary{} },
	func() runtime.Object { return &DashboardSummaryList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
