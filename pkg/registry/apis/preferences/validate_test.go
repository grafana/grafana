package preferences

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
)

func TestAPIBuilder_Validate(t *testing.T) {
	prefsGVK := preferences.GroupVersion.WithKind("Preferences")
	prefsGVR := preferences.GroupVersion.WithResource("preferences")
	otherGVR := preferences.GroupVersion.WithResource("other")

	newPrefs := func(theme, timezone *string) *preferences.Preferences {
		return &preferences.Preferences{
			ObjectMeta: metav1.ObjectMeta{Name: "user-1", Namespace: "default"},
			Spec: preferences.PreferencesSpec{
				Theme:    theme,
				Timezone: timezone,
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
			name:     "valid create with no theme or timezone",
			obj:      newPrefs(nil, nil),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid create with empty theme",
			obj:      newPrefs(new(""), nil),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid create with valid theme",
			obj:      newPrefs(new("dark"), nil),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid create with extra theme",
			obj:      newPrefs(new("aubergine"), nil),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:       "invalid theme on create",
			obj:        newPrefs(new("not-a-real-theme"), nil),
			op:         admission.Create,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "invalid theme",
		},
		{
			name:     "valid update with valid theme",
			obj:      newPrefs(new("light"), nil),
			oldObj:   newPrefs(new("dark"), nil),
			op:       admission.Update,
			resource: prefsGVR,
		},
		{
			name:       "invalid theme on update",
			obj:        newPrefs(new("bogus"), nil),
			oldObj:     newPrefs(new("dark"), nil),
			op:         admission.Update,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "invalid theme",
		},
		{
			name:     "valid utc timezone",
			obj:      newPrefs(nil, new("utc")),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid browser timezone",
			obj:      newPrefs(nil, new("browser")),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid empty timezone",
			obj:      newPrefs(nil, new("")),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid IANA timezone",
			obj:      newPrefs(nil, new("America/New_York")),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:       "invalid timezone",
			obj:        newPrefs(nil, new("Mars/Olympus_Mons")),
			op:         admission.Create,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "invalid timezone",
		},
		{
			name:       "invalid timezone on update",
			obj:        newPrefs(nil, new("Not/A_Zone")),
			oldObj:     newPrefs(nil, new("utc")),
			op:         admission.Update,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "invalid timezone",
		},
		{
			name:     "valid theme and timezone together",
			obj:      newPrefs(new("system"), new("Europe/London")),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "delete operation is skipped",
			obj:      newPrefs(new("not-a-real-theme"), new("Not/A_Zone")),
			op:       admission.Delete,
			resource: prefsGVR,
		},
		{
			name:     "connect operation is skipped",
			obj:      newPrefs(new("not-a-real-theme"), nil),
			op:       admission.Connect,
			resource: prefsGVR,
		},
		{
			name:     "non-preferences resource is skipped",
			obj:      newPrefs(new("not-a-real-theme"), new("Not/A_Zone")),
			op:       admission.Create,
			resource: otherGVR,
		},
		{
			name:       "wrong object type returns bad request",
			obj:        &preferences.PreferencesList{},
			op:         admission.Create,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "expected Preferences object",
		},
	}

	b := &APIBuilder{}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attrs := admission.NewAttributesRecord(
				tt.obj,
				tt.oldObj,
				prefsGVK,
				"default",
				"user-1",
				tt.resource,
				"",
				tt.op,
				nil,
				false,
				nil,
			)

			err := b.Validate(context.Background(), attrs, nil)
			if tt.wantErr {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.errMessage)
				return
			}
			require.NoError(t, err)
		})
	}
}
