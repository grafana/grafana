package preferences

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
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

	newPrefs := func(spec preferences.PreferencesSpec) *preferences.Preferences {
		return &preferences.Preferences{
			ObjectMeta: metav1.ObjectMeta{Name: "user-1", Namespace: "default"},
			Spec:       spec,
		}
	}

	tests := []struct {
		name       string
		obj        runtime.Object
		oldObj     runtime.Object
		op         admission.Operation
		resource   schema.GroupVersionResource
		wantErr    bool
		errMessage string             // expected substring of err.Error()
		errFields  []string           // expected spec.<field> paths in StatusDetails causes, in order
		errTypes   []metav1.CauseType // expected cause types per field, in same order as errFields
	}{
		{
			name:     "valid create with empty spec",
			obj:      newPrefs(preferences.PreferencesSpec{}),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid create with empty theme",
			obj:      newPrefs(preferences.PreferencesSpec{Theme: new("")}),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid create with built-in theme",
			obj:      newPrefs(preferences.PreferencesSpec{Theme: new("dark")}),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid create with extra theme",
			obj:      newPrefs(preferences.PreferencesSpec{Theme: new("aubergine")}),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:       "invalid theme on create",
			obj:        newPrefs(preferences.PreferencesSpec{Theme: new("not-a-real-theme")}),
			op:         admission.Create,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "is invalid",
			errFields:  []string{"spec.theme"},
			errTypes:   []metav1.CauseType{metav1.CauseTypeFieldValueInvalid},
		},
		{
			name:     "valid update with valid theme",
			obj:      newPrefs(preferences.PreferencesSpec{Theme: new("light")}),
			oldObj:   newPrefs(preferences.PreferencesSpec{Theme: new("dark")}),
			op:       admission.Update,
			resource: prefsGVR,
		},
		{
			name:       "invalid theme on update",
			obj:        newPrefs(preferences.PreferencesSpec{Theme: new("bogus")}),
			oldObj:     newPrefs(preferences.PreferencesSpec{Theme: new("dark")}),
			op:         admission.Update,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "is invalid",
			errFields:  []string{"spec.theme"},
			errTypes:   []metav1.CauseType{metav1.CauseTypeFieldValueInvalid},
		},
		{
			name:     "valid utc timezone",
			obj:      newPrefs(preferences.PreferencesSpec{Timezone: new("utc")}),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid browser timezone",
			obj:      newPrefs(preferences.PreferencesSpec{Timezone: new("browser")}),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid empty timezone",
			obj:      newPrefs(preferences.PreferencesSpec{Timezone: new("")}),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:     "valid IANA timezone",
			obj:      newPrefs(preferences.PreferencesSpec{Timezone: new("America/New_York")}),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:       "invalid timezone",
			obj:        newPrefs(preferences.PreferencesSpec{Timezone: new("Mars/Olympus_Mons")}),
			op:         admission.Create,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "is invalid",
			errFields:  []string{"spec.timezone"},
			errTypes:   []metav1.CauseType{metav1.CauseTypeFieldValueInvalid},
		},
		{
			name:       "invalid timezone on update",
			obj:        newPrefs(preferences.PreferencesSpec{Timezone: new("Not/A_Zone")}),
			oldObj:     newPrefs(preferences.PreferencesSpec{Timezone: new("utc")}),
			op:         admission.Update,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "is invalid",
			errFields:  []string{"spec.timezone"},
			errTypes:   []metav1.CauseType{metav1.CauseTypeFieldValueInvalid},
		},
		{
			name:     "valid theme and timezone together",
			obj:      newPrefs(preferences.PreferencesSpec{Theme: new("system"), Timezone: new("Europe/London")}),
			op:       admission.Create,
			resource: prefsGVR,
		},
		{
			name:       "homeURL is rejected on create",
			obj:        newPrefs(preferences.PreferencesSpec{HomeURL: new("https://example.com")}),
			op:         admission.Create,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "is invalid",
			errFields:  []string{"spec.homeURL"},
			errTypes:   []metav1.CauseType{metav1.CauseTypeForbidden},
		},
		{
			name:       "homeURL is rejected even when empty",
			obj:        newPrefs(preferences.PreferencesSpec{HomeURL: new("")}),
			op:         admission.Create,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "is invalid",
			errFields:  []string{"spec.homeURL"},
			errTypes:   []metav1.CauseType{metav1.CauseTypeForbidden},
		},
		{
			name:       "homeURL is rejected on update",
			obj:        newPrefs(preferences.PreferencesSpec{HomeURL: new("https://example.com")}),
			oldObj:     newPrefs(preferences.PreferencesSpec{}),
			op:         admission.Update,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "is invalid",
			errFields:  []string{"spec.homeURL"},
			errTypes:   []metav1.CauseType{metav1.CauseTypeForbidden},
		},
		{
			name: "all invalid fields are reported together",
			obj: newPrefs(preferences.PreferencesSpec{
				HomeURL:  new("https://example.com"),
				Timezone: new("Not/A_Zone"),
				Theme:    new("not-a-real-theme"),
			}),
			op:         admission.Create,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "is invalid",
			errFields:  []string{"spec.homeURL", "spec.timezone", "spec.theme"},
			errTypes: []metav1.CauseType{
				metav1.CauseTypeForbidden,
				metav1.CauseTypeFieldValueInvalid,
				metav1.CauseTypeFieldValueInvalid,
			},
		},
		{
			name: "invalid timezone and theme are both reported",
			obj: newPrefs(preferences.PreferencesSpec{
				Theme:    new("not-a-real-theme"),
				Timezone: new("Not/A_Zone"),
			}),
			op:         admission.Create,
			resource:   prefsGVR,
			wantErr:    true,
			errMessage: "is invalid",
			errFields:  []string{"spec.timezone", "spec.theme"},
			errTypes: []metav1.CauseType{
				metav1.CauseTypeFieldValueInvalid,
				metav1.CauseTypeFieldValueInvalid,
			},
		},
		{
			name:     "delete operation is skipped",
			obj:      newPrefs(preferences.PreferencesSpec{Theme: new("not-a-real-theme"), Timezone: new("Not/A_Zone"), HomeURL: new("https://x")}),
			op:       admission.Delete,
			resource: prefsGVR,
		},
		{
			name:     "connect operation is skipped",
			obj:      newPrefs(preferences.PreferencesSpec{Theme: new("not-a-real-theme")}),
			op:       admission.Connect,
			resource: prefsGVR,
		},
		{
			name:     "non-preferences resource is skipped",
			obj:      newPrefs(preferences.PreferencesSpec{Theme: new("not-a-real-theme"), HomeURL: new("https://x")}),
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
			if !tt.wantErr {
				require.NoError(t, err)
				return
			}

			require.Error(t, err)
			require.Contains(t, err.Error(), tt.errMessage)

			if tt.errFields == nil {
				return
			}

			statusErr, ok := errors.AsType[*apierrors.StatusError](err)
			require.True(t, ok, "expected *apierrors.StatusError, got %T", err)
			require.Equal(t, metav1.StatusReasonInvalid, statusErr.ErrStatus.Reason)
			require.NotNil(t, statusErr.ErrStatus.Details, "expected StatusDetails to be populated")

			gotFields := make([]string, 0, len(statusErr.ErrStatus.Details.Causes))
			gotTypes := make([]metav1.CauseType, 0, len(statusErr.ErrStatus.Details.Causes))
			for _, cause := range statusErr.ErrStatus.Details.Causes {
				require.NotEmpty(t, cause.Message, "cause message must not be empty for field %s", cause.Field)
				gotFields = append(gotFields, cause.Field)
				gotTypes = append(gotTypes, cause.Type)
			}
			require.Equal(t, tt.errFields, gotFields)
			if tt.errTypes != nil {
				require.Equal(t, tt.errTypes, gotTypes)
			}
		})
	}
}
