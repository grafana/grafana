package v0alpha1

import (
	"fmt"
	time "time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var PalettesResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"palettes", "palettes", "Palette",
	func() runtime.Object { return &Palette{} },
	func() runtime.Object { return &PaletteList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Group", Type: "string"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]any, error) {
			p, ok := obj.(*Palette)
			if ok && p != nil {
				group := ""
				if p.Spec.Group != nil {
					group = *p.Spec.Group
				}

				return []any{
					p.Name,
					group,
					p.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected palette")
		},
	},
)

var (
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
	schemeGroupVersion = GroupVersion
)

func init() {
	localSchemeBuilder.Register(addKnownTypes, addDefaultingFuncs)
}

// Adds the list of known types to the given scheme.
func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(schemeGroupVersion,
		&Palette{},
		&PaletteList{},
	)
	metav1.AddToGroupVersion(scheme, schemeGroupVersion)
	return nil
}

func addDefaultingFuncs(scheme *runtime.Scheme) error {
	return nil // return RegisterDefaults(scheme)
}
