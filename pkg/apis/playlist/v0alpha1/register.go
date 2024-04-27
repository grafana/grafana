package v0alpha1

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const (
	GROUP      = "playlist.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var PlaylistResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	"playlists", "playlist", "Playlist",
	func() runtime.Object { return &Playlist{} },
	func() runtime.Object { return &PlaylistList{} },
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
