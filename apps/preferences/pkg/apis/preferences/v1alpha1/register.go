package v1alpha1

import (
	"fmt"
	time "time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	prefsv1 "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var PreferencesResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"preferences", "preferences", "Preferences",
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
	SchemeGroupVersion = schema.GroupVersion{Group: APIGroup, Version: APIVersion}

	// GetOpenAPIDefinitions is shared with v1 (identical schema); the served v1alpha1
	// spec uses v1 model keys, mirroring the folder app.
	GetOpenAPIDefinitions = prefsv1.GetOpenAPIDefinitions
)
