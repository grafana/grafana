package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	GROUP      = "notifications.alerting.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
