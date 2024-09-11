package v0alpha1

import (
	"fmt"
	"time"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

const (
	GROUP         = "playlist.grafana.app"
	VERSION       = "v0alpha1"
	APIVERSION    = GROUP + "/" + VERSION
	RESOURCE      = "playlists"
	GROUPRESOURCE = GROUP + "/" + RESOURCE
)

var PlaylistResourceInfo = common.NewResourceInfo(GROUP, VERSION,
	RESOURCE, "playlist", "Playlist",
	func() runtime.Object { return &Playlist{} },
	func() runtime.Object { return &PlaylistList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The playlist name"},
			{Name: "Interval", Type: "string", Format: "string", Description: "How often the playlist will update"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*Playlist)
			if !ok {
				return nil, fmt.Errorf("expected playlist")
			}
			return []interface{}{
				m.Name,
				m.Spec.Title,
				m.Spec.Interval,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
