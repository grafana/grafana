package v0alpha1

import (
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apis"
)

const (
	GROUP      = "featureflags.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var FeatureResourceInfo = apis.NewResourceInfo(GROUP, VERSION,
	"features", "feature", "Feature",
	func() runtime.Object { return &Feature{} },
	func() runtime.Object { return &FeatureList{} },
)

var TogglesResourceInfo = apis.NewResourceInfo(GROUP, VERSION,
	"toggles", "toggles", "FeatureToggles",
	func() runtime.Object { return &FeatureToggles{} },
	func() runtime.Object { return &FeatureTogglesList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
