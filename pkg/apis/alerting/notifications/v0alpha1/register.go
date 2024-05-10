package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "notifications.alerting.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var TimeIntervalResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"time-intervals", "time-interval", "TimeIntervals",
	func() runtime.Object { return &TimeInterval{} },
	func() runtime.Object { return &TimeIntervalList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
