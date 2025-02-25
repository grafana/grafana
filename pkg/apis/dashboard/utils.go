package dashboard

import (
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var fileProvisionedRepoPrefix = "file:"

// ProvisionedFileNameWithPrefix adds the `file:` prefix to the
// provisioner name, to be used as the annotation for dashboards
// provisioned from files
func ProvisionedFileNameWithPrefix(name string) string {
	if name == "" {
		return ""
	}

	return fileProvisionedRepoPrefix + name
}

// GetProvisionedFileNameFromMeta returns the provisioner name
// from a given annotation string, which is in the form file:<name>
func GetProvisionedFileNameFromMeta(annotation string) (string, bool) {
	return strings.CutPrefix(annotation, fileProvisionedRepoPrefix)
}

// SetPluginIDMeta sets the repo name to "plugin" and the path to the plugin ID
func SetPluginIDMeta(obj unstructured.Unstructured, pluginID string) {
	if pluginID == "" {
		return
	}

	annotations := obj.GetAnnotations()
	if annotations == nil {
		annotations = map[string]string{}
	}
	annotations[utils.AnnoKeyManagerKind] = string(utils.ManagerKindPlugin)
	annotations[utils.AnnoKeyManagerIdentity] = pluginID
	obj.SetAnnotations(annotations)
}

// GetPluginIDFromMeta returns the plugin ID from the meta if the repo name is "plugin"
func GetPluginIDFromMeta(obj utils.GrafanaMetaAccessor) string {
	p, ok := obj.GetManagerProperties()
	if ok && p.Kind == utils.ManagerKindPlugin {
		return p.Identity
	}
	return ""
}
