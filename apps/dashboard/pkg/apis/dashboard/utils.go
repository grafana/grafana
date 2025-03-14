package dashboard

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// SetPluginIDMeta sets the repo name to "plugin" and the path to the plugin ID
func SetPluginIDMeta(obj *unstructured.Unstructured, pluginID string) {
	if pluginID == "" {
		return
	}

	meta, err := utils.MetaAccessor(obj)
	if err == nil {
		meta.SetManagerProperties(utils.ManagerProperties{
			Kind:     utils.ManagerKindPlugin,
			Identity: pluginID,
		})
	}
}

// GetPluginIDFromMeta returns the plugin ID from the meta if the repo name is "plugin"
func GetPluginIDFromMeta(obj utils.GrafanaMetaAccessor) string {
	p, ok := obj.GetManagerProperties()
	if ok && p.Kind == utils.ManagerKindPlugin {
		return p.Identity
	}
	return ""
}
