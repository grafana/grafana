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

var TemplateGroupResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"template-groups", "template-group", "TemplateGroup",
	func() runtime.Object { return &TemplateGroup{} },
	func() runtime.Object { return &TemplateGroupList{} },
)

var TemplateResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"templates", "template", "Template",
	func() runtime.Object { return &Template{} },
	func() runtime.Object { return &TemplateList{} },
)

var TimeIntervalResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"time-intervals", "time-interval", "TimeIntervals",
	func() runtime.Object { return &TimeInterval{} },
	func() runtime.Object { return &TimeIntervalList{} },
)

var ReceiverResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"receivers", "receiver", "Receiver",
	func() runtime.Object { return &Receiver{} },
	func() runtime.Object { return &ReceiverList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
