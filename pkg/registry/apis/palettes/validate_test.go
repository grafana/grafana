package palettes

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	palettesapi "github.com/grafana/grafana/apps/palettes/pkg/apis/palettes/v0alpha1"
)

func TestAdmissionValidate(t *testing.T) {
	info := palettesapi.PalettesResourceInfo
	paletteGVK := info.GroupVersionKind()
	paletteGVR := info.GroupVersionResource()
	otherGVR := schema.GroupVersionResource{Group: info.GroupVersion().Group, Version: info.GroupVersion().Version, Resource: "other"}

	longID := strings.Repeat("a", 64)
	validColors := []string{"#abc", "#010203", "#010203ff"}

	newPalette := func(name, id, displayName string, colors []string, share []palettesapi.PalettePaletteVisibility, group *string) *palettesapi.Palette {
		return &palettesapi.Palette{
			ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: "default"},
			Spec: palettesapi.PaletteSpec{
				Id:          id,
				DisplayName: displayName,
				Group:       group,
				Colors:      colors,
				ShareWith:   share,
			},
		}
	}

	tests := []struct {
		name       string
		obj        runtime.Object
		oldObj     runtime.Object
		op         admission.Operation
		resource   schema.GroupVersionResource
		wantErr    bool
		errMessage string
	}{
		{
			name: "happy path create org palette",
			obj: newPalette("org-sunset", "sunset", "Sunset", validColors,
				[]palettesapi.PalettePaletteVisibility{"org", "user-alice", "team-frontend"},
				ptr("Custom")),
			op:       admission.Create,
			resource: paletteGVR,
		},
		{
			name: "happy path create user palette with namespace share scope",
			obj: newPalette("user-bob-forest", "forest", "Forest", validColors,
				[]palettesapi.PalettePaletteVisibility{"namespace"}, nil),
			op:       admission.Create,
			resource: paletteGVR,
		},
		{
			name: "happy path update",
			obj:  newPalette("user-alice-warm", "warm", "Warm", validColors, nil, nil),
			oldObj: newPalette("user-alice-warm", "warm", "Warm", []string{"#000"}, nil,
				nil),
			op:       admission.Update,
			resource: paletteGVR,
		},
		{
			name:       "invalid metadata.name shape",
			obj:        newPalette("not-a-palette", "x", "X", validColors, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "metadata.name",
		},
		{
			name:       "org- with empty slug",
			obj:        newPalette("org-", "x", "X", validColors, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "metadata.name",
		},
		{
			name:       "spec.id must match name suffix",
			obj:        newPalette("org-sunset", "dawn", "Sunset", validColors, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.id",
		},
		{
			name:       "spec.id fails DNS label pattern",
			obj:        newPalette("org-Bad_ID", "Bad_ID", "Bad", validColors, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.id",
		},
		{
			name:       "spec.id too long",
			obj:        newPalette("org-"+longID, longID, "Long", validColors, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.id",
		},
		{
			name:       "spec.displayName empty",
			obj:        newPalette("org-x", "x", "", validColors, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.displayName",
		},
		{
			name:       "spec.displayName whitespace only",
			obj:        newPalette("org-x", "x", "   \t  ", validColors, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.displayName",
		},
		{
			name:       "spec.displayName too long",
			obj:        newPalette("org-x", "x", strings.Repeat("n", 129), validColors, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.displayName",
		},
		{
			name:       "spec.group too long",
			obj:        newPalette("org-x", "x", "Hi", validColors, nil, ptr(strings.Repeat("g", 65))),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.group",
		},
		{
			name:       "spec.colors empty",
			obj:        newPalette("org-x", "x", "Hi", []string{}, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.colors",
		},
		{
			name:       "spec.colors too many entries",
			obj:        newPalette("org-x", "x", "Hi", manyHexColors(65), nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.colors",
		},
		{
			name:       "spec.colors non-hex entry",
			obj:        newPalette("org-x", "x", "Hi", []string{"#gggggg", "#010203"}, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.colors[0]",
		},
		{
			name:       "spec.colors invalid length",
			obj:        newPalette("org-x", "x", "Hi", []string{"#12"}, nil, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.colors[0]",
		},
		{
			name: "spec.shareWith empty entry",
			obj: newPalette("org-x", "x", "Hi", validColors,
				[]palettesapi.PalettePaletteVisibility{"org", ""}, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.shareWith[1]",
		},
		{
			name: "spec.shareWith unrecognized scope",
			obj: newPalette("org-x", "x", "Hi", validColors,
				[]palettesapi.PalettePaletteVisibility{"everyone"}, nil),
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "spec.shareWith[0]",
		},
		{
			name:       "wrong object type",
			obj:        &palettesapi.PaletteList{},
			op:         admission.Create,
			resource:   paletteGVR,
			wantErr:    true,
			errMessage: "expected Palette object",
		},
		{
			name:     "delete operation skipped",
			obj:      newPalette("org-x", "x", "", nil, nil, nil),
			op:       admission.Delete,
			resource: paletteGVR,
		},
		{
			name:     "non-palette resource skipped",
			obj:      newPalette("org-x", "x", "", nil, nil, nil),
			op:       admission.Create,
			resource: otherGVR,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attrs := admission.NewAttributesRecord(
				tt.obj,
				tt.oldObj,
				paletteGVK,
				"default",
				"org-sunset",
				tt.resource,
				"",
				tt.op,
				nil,
				false,
				nil,
			)

			err := AdmissionValidate(context.Background(), attrs, nil)
			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errMessage)
				return
			}
			require.NoError(t, err)
		})
	}
}

func ptr(s string) *string { return &s }

func manyHexColors(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = "#010203"
	}
	return out
}
