package playlist

import (
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"

	playlist "github.com/grafana/grafana/apps/playlist/apis/playlist/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
)

func newStorage(scheme *runtime.Scheme, optsGetter generic.RESTOptionsGetter, legacy *legacyStorage) (*genericregistry.Store, error) {
	kind := playlist.PlaylistKind()
	singular := strings.ToLower(kind.Kind()) // ???
	resourceInfo := utils.NewResourceInfo(
		kind.Group(), kind.Version(),
		kind.GroupVersionResource().Resource, singular,
		kind.Kind(),
		func() runtime.Object {
			return kind.ZeroValue()
		},
		func() runtime.Object {
			return kind.ZeroListValue()
		},
		utils.TableColumns{}, // will use default columns... TODO? legacy.tableConverter.,
	)
	return grafanaregistry.NewRegistryStore(scheme, resourceInfo, optsGetter)
}
