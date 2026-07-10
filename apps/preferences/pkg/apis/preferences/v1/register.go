package v1

import (
	"fmt"
	time "time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP         = APIGroup
	VERSION       = APIVersion
	RESOURCE      = "preferences"
	APIVERSION    = GROUP + "/" + VERSION
	RESOURCEGROUP = RESOURCE + "." + GROUP
)

var PreferencesResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	RESOURCE, "preferences", "Preferences",
	func() runtime.Object { return &Preferences{} },
	func() runtime.Object { return &PreferencesList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]any, error) {
			p, ok := obj.(*Preferences)
			if ok && p != nil {
				return []any{
					p.Name,
					p.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected preferences")
		},
	},
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
