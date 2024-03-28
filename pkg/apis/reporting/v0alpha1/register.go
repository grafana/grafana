package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
)

const (
	GROUP      = "reporting.grafana.app"
	VERSION    = "v0alpha1"
	RESOURCE   = "reports"
	APIVERSION = GROUP + "/" + VERSION
)

var ReportResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	RESOURCE, "report", "Report",
	func() runtime.Object { return &Report{} },
	func() runtime.Object { return &ReportList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
