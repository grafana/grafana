package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const VERSION = "v0alpha1"

// The app plugin resource name
// Although this is really "settings", it is also the external root url for the scoped behavior
const APP_RESOURCE_NAME = "app"

// App plugins currently only support a single instance, that MUST be named "instance"
// The URLs will look like:
//
//	/apis/{group}/{version}/namespaces/{namespace}/app/instance
//
// Access to the plugin is controlled by sub-resource paths under this URL, for example:
//
//	/apis/{group}/{version}/namespaces/{namespace}/app/instance/health
//	/apis/{group}/{version}/namespaces/{namespace}/app/instance/proxy
//	/apis/{group}/{version}/namespaces/{namespace}/app/instance/resources
const INSTANCE_NAME = "instance"

// SettingsResourceInfo describes the settings resource. The group is left empty
// because it is dynamic (one per app plugin) and must be set via WithGroupAndShortName.
var SettingsResourceInfo = utils.NewResourceInfo("", VERSION,
	APP_RESOURCE_NAME, APP_RESOURCE_NAME, "Settings",
	func() runtime.Object { return &Settings{} },
	func() runtime.Object { return &SettingsList{} },
	utils.TableColumns{},
)

// AddKnownTypes registers the Settings types with the given scheme and group version.
// The group is dynamic (one per app plugin), so it must be provided by the caller.
func AddKnownTypes(scheme *runtime.Scheme, gv schema.GroupVersion) error {
	scheme.AddKnownTypes(gv,
		&Settings{},
		&SettingsList{},
		&HealthCheckResult{},
		&metav1.Status{},
	)
	metav1.AddToGroupVersion(scheme, gv)
	return nil
}
