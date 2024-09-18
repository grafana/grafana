package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "dashboardsnapshot.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var DashboardSnapshotResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"dashboardsnapshots", "dashboardsnapshot", "DashboardSnapshot",
	func() runtime.Object { return &DashboardSnapshot{} },
	func() runtime.Object { return &DashboardSnapshotList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
