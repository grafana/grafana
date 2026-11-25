package dashboard

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8svalidation "k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apiserver/pkg/admission"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func newDashboardPreferences(name string) *dashv2beta1.DashboardPreferences {
	obj := &dashv2beta1.DashboardPreferences{}
	obj.SetName(name)
	return obj
}

func withFolderAnnotation(obj *dashv2beta1.DashboardPreferences, folderUID string) *dashv2beta1.DashboardPreferences {
	obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	return obj
}

// The objects are untyped so an absent one is a real nil: a nil *DashboardPreferences held in a
// runtime.Object is not == nil, so an Update with no old object would appear to carry one. It also
// lets a row pass another kind.
func dashboardPreferencesAttributesForOp(op admission.Operation, newObj, oldObj runtime.Object) admission.Attributes {
	switch op {
	case admission.Create:
		return admission.NewAttributesRecord(
			newObj,
			nil,
			dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind(),
			"stacks-1",
			newObj.(metav1.Object).GetName(),
			dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionResource(),
			"",
			admission.Create,
			&metav1.CreateOptions{},
			false,
			nil,
		)
	case admission.Update:
		return admission.NewAttributesRecord(
			newObj,
			oldObj,
			dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind(),
			"stacks-1",
			newObj.(metav1.Object).GetName(),
			dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionResource(),
			"",
			admission.Update,
			&metav1.UpdateOptions{},
			false,
			nil,
		)
	default:
		return admission.NewAttributesRecord(
			nil,
			oldObj,
			dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionKind(),
			"stacks-1",
			oldObj.(metav1.Object).GetName(),
			dashv2beta1.DashboardPreferencesResourceInfo.GroupVersionResource(),
			"",
			admission.Delete,
			&metav1.DeleteOptions{},
			false,
			nil,
		)
	}
}

func TestDashboardsAPIBuilderMutateDashboardPreferences(t *testing.T) {
	builder := &DashboardsAPIBuilder{}
	ctx := context.Background()

	mutate := func(op admission.Operation, obj *dashv2beta1.DashboardPreferences) error {
		return builder.Mutate(ctx, dashboardPreferencesAttributesForOp(op, obj, nil), nil)
	}
	withLabels := func(obj *dashv2beta1.DashboardPreferences, labels map[string]string) *dashv2beta1.DashboardPreferences {
		obj.SetLabels(labels)
		return obj
	}
	ops := []struct {
		name string
		op   admission.Operation
	}{
		{"create", admission.Create},
		{"update", admission.Update},
	}

	orgLabels := map[string]string{dashboardPreferencesTierLabelKey: "org"}
	userLabels := map[string]string{dashboardPreferencesTierLabelKey: "user"}
	folderLabels := map[string]string{dashboardPreferencesTierLabelKey: "folder"}

	t.Run("name and labels follow the scope", func(t *testing.T) {
		tests := []struct {
			name       string
			op         admission.Operation
			obj        *dashv2beta1.DashboardPreferences
			wantName   string
			wantLabels map[string]string
		}{
			{name: "folder create", op: admission.Create, obj: newDashboardPreferences("folder-f1"), wantName: "folder-f1", wantLabels: folderLabels},
			// A label value must start and end with an alphanumeric character and a folder UID need not, so
			// the UID cannot be copied into a label.
			{name: "folder create with a UID that starts with an underscore", op: admission.Create, obj: newDashboardPreferences("folder-_lead"), wantName: "folder-_lead", wantLabels: folderLabels},
			{name: "folder create with a UID that ends with a dash", op: admission.Create, obj: newDashboardPreferences("folder-trail-"), wantName: "folder-trail-", wantLabels: folderLabels},
			{name: "org create without name", op: admission.Create, obj: newDashboardPreferences(""), wantName: "namespace", wantLabels: orgLabels},
			{name: "user create", op: admission.Create, obj: newDashboardPreferences("user-u1"), wantName: "user-u1", wantLabels: userLabels},
			{name: "name not derived on update", op: admission.Update, obj: newDashboardPreferences(""), wantName: "", wantLabels: orgLabels},
			{
				name:       "annotation removed on update",
				op:         admission.Update,
				obj:        withLabels(newDashboardPreferences("namespace"), map[string]string{dashboardPreferencesFolderLabelKey: "f1"}),
				wantName:   "namespace",
				wantLabels: orgLabels,
			},
			// List finds folder-tier objects by the tier label, so a client must not get to choose it.
			{
				name: "labels the server owns are rewritten and the rest kept",
				op:   admission.Create,
				obj: withLabels(newDashboardPreferences("user-u1"), map[string]string{
					dashboardPreferencesTierLabelKey:   "folder",
					dashboardPreferencesFolderLabelKey: "f1",
					"team":                             "a",
				}),
				wantName:   "user-u1",
				wantLabels: map[string]string{dashboardPreferencesTierLabelKey: "user", "team": "a"},
			},
			// Nothing here sets the folder label, so one a client sends has to go on the folder tier too.
			{
				name:       "folder label sent by the client removed on the folder tier",
				op:         admission.Create,
				obj:        withLabels(newDashboardPreferences("folder-f1"), map[string]string{dashboardPreferencesFolderLabelKey: "f2"}),
				wantName:   "folder-f1",
				wantLabels: folderLabels,
			},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				require.NoError(t, mutate(tt.op, tt.obj))

				// ObjectMeta validation runs in the registry store after mutation, and a label value that is
				// not valid fails the write with a 422.
				for key, value := range tt.obj.GetLabels() {
					require.Empty(t, k8svalidation.IsValidLabelValue(value), "label %q has value %q", key, value)
				}
				require.Equal(t, tt.wantName, tt.obj.GetName())
				require.Equal(t, tt.wantLabels, tt.obj.GetLabels())
			})
		}
	})

	t.Run("an object with no scope is a bad request", func(t *testing.T) {
		const folderAnnotation = "dashboard preferences can't have the grafana.app/folder annotation; the folder tier is named folder-<folderUID>"
		const notATierName = "is not a dashboard preferences name; use namespace, folder-<folderUID> or user-<userUID>"
		tests := []struct {
			name, objName, folderUID, wantErr string
		}{
			// A nameless POST with the annotation was how the folder tier used to be created.
			{name: "folder annotation without a name", folderUID: "f1", wantErr: folderAnnotation},
			{name: "folder annotation on the folder tier", objName: "folder-f1", folderUID: "f1", wantErr: folderAnnotation},
			{name: "folder annotation on the user tier", objName: "user-u1", folderUID: "f1", wantErr: folderAnnotation},
			// Storage refuses any folder annotation for this resource, the root's general included.
			{name: "general folder annotation", objName: "namespace", folderUID: "general", wantErr: folderAnnotation},
			{name: "a name that isn't a tier's", objName: "foo", wantErr: `metadata.name "foo" ` + notATierName},
			{name: "a user tier name without a user", objName: "user-", wantErr: `metadata.name "user-" ` + notATierName},
		}
		for _, tt := range tests {
			for _, o := range ops {
				t.Run(tt.name+" on "+o.name, func(t *testing.T) {
					obj := newDashboardPreferences(tt.objName)
					if tt.folderUID != "" {
						withFolderAnnotation(obj, tt.folderUID)
					}

					err := mutate(o.op, obj)

					require.True(t, apierrors.IsBadRequest(err), "expected a BadRequest, got %v", err)
					require.EqualError(t, err, tt.wantErr)
				})
			}
		}
	})

	t.Run("objects with no member set are dropped", func(t *testing.T) {
		tests := []struct{ name, spec, want string }{
			{"empty dashboard", `{"dashboard":{}}`, `{}`},
			{"empty panels", `{"panels":{}}`, `{}`},
			// Dropped from the bottom up, so a parent left with only empty children goes too.
			{"dashboard with only an empty auto grid", `{"dashboard":{"autoGrid":{}}}`, `{}`},
			{"panels with only an empty legend", `{"panels":{"legend":{}}}`, `{}`},
			{"panels with only an empty tooltip", `{"panels":{"tooltip":{}}}`, `{}`},
			{"panels with only an empty axis", `{"panels":{"axis":{}}}`, `{}`},
			{"panels with only an empty graph", `{"panels":{"graph":{}}}`, `{}`},
			{"panels with only an empty field", `{"panels":{"field":{}}}`, `{}`},
			{"panels with only an empty frame", `{"panels":{"frame":{}}}`, `{}`},
			{
				"every empty object dropped and the rest kept",
				`{"dashboard":{"preload":true,"autoGrid":{}},"panels":{"legend":{},"tooltip":{},"axis":{},"graph":{},"field":{},"frame":{"transparent":true}}}`,
				`{"dashboard":{"preload":true},"panels":{"frame":{"transparent":true}}}`,
			},
			// A set false, 0 or "" is a value, not an absence.
			{"dashboard member set to false kept", `{"dashboard":{"preload":false}}`, `{"dashboard":{"preload":false}}`},
			{"dashboard member set to an empty string kept", `{"dashboard":{"autoRefresh":""}}`, `{"dashboard":{"autoRefresh":""}}`},
			{"dashboard member set to zero kept", `{"dashboard":{"fiscalYearStartMonth":0}}`, `{"dashboard":{"fiscalYearStartMonth":0}}`},
			{"auto grid member set to false kept", `{"dashboard":{"autoGrid":{"fillScreen":false}}}`, `{"dashboard":{"autoGrid":{"fillScreen":false}}}`},
			{"auto grid member set to zero kept", `{"dashboard":{"autoGrid":{"maxColumnCount":0}}}`, `{"dashboard":{"autoGrid":{"maxColumnCount":0}}}`},
			{"legend member set to false kept", `{"panels":{"legend":{"showLegend":false}}}`, `{"panels":{"legend":{"showLegend":false}}}`},
			{"tooltip member set to false kept", `{"panels":{"tooltip":{"hideZeros":false}}}`, `{"panels":{"tooltip":{"hideZeros":false}}}`},
			{"axis member set to false kept", `{"panels":{"axis":{"axisGridShow":false}}}`, `{"panels":{"axis":{"axisGridShow":false}}}`},
			{"graph member set to zero kept", `{"panels":{"graph":{"lineWidth":0}}}`, `{"panels":{"graph":{"lineWidth":0}}}`},
			{"field member set to zero kept", `{"panels":{"field":{"decimals":0}}}`, `{"panels":{"field":{"decimals":0}}}`},
			{"frame member set to false kept", `{"panels":{"frame":{"transparent":false}}}`, `{"panels":{"frame":{"transparent":false}}}`},
			// Its members are required, so an empty one has to reach Validate and fail there.
			{"empty time range kept", `{"dashboard":{"timeRange":{}}}`, `{"dashboard":{"timeRange":{"from":"","to":""}}}`},
		}
		for _, tt := range tests {
			for _, o := range ops {
				t.Run(tt.name+" on "+o.name, func(t *testing.T) {
					obj := newDashboardPreferences("namespace")
					require.NoError(t, json.Unmarshal([]byte(tt.spec), &obj.Spec))

					require.NoError(t, mutate(o.op, obj))

					got, err := json.Marshal(obj.Spec)
					require.NoError(t, err)
					require.JSONEq(t, tt.want, string(got))
				})
			}
		}
	})

	// Validate rejects an empty list, and it encodes as no list at all, so only the Go value shows it is kept.
	t.Run("an empty refresh interval list is kept", func(t *testing.T) {
		for _, o := range ops {
			t.Run(o.name, func(t *testing.T) {
				obj := newDashboardPreferences("namespace")
				require.NoError(t, json.Unmarshal([]byte(`{"dashboard":{"autoRefreshIntervals":[]}}`), &obj.Spec))

				require.NoError(t, mutate(o.op, obj))

				require.NotNil(t, obj.Spec.Dashboard)
				require.Equal(t, []string{}, obj.Spec.Dashboard.AutoRefreshIntervals)
			})
		}
	})

	t.Run("finalizers and owner references are cleared", func(t *testing.T) {
		for _, o := range ops {
			t.Run(o.name, func(t *testing.T) {
				obj := newDashboardPreferences("user-u1")
				obj.SetFinalizers([]string{"keep"})
				obj.SetOwnerReferences([]metav1.OwnerReference{{APIVersion: "v1", Kind: "ConfigMap", Name: "owner", UID: "owner-uid"}})

				require.NoError(t, mutate(o.op, obj))

				require.Empty(t, obj.GetFinalizers())
				require.Empty(t, obj.GetOwnerReferences())
			})
		}
	})

	// Mutate returns early for anything that is not a create or an update, so the old object a delete
	// carries is never touched.
	t.Run("leaves a delete alone", func(t *testing.T) {
		old := newDashboardPreferences("user-u1")
		old.SetFinalizers([]string{"keep"})

		require.NoError(t, builder.Mutate(ctx, dashboardPreferencesAttributesForOp(admission.Delete, nil, old), nil))

		require.Equal(t, []string{"keep"}, old.GetFinalizers())
		require.Empty(t, old.GetLabels())
	})

	t.Run("rejects another object type", func(t *testing.T) {
		err := builder.Mutate(ctx, dashboardPreferencesAttributesForOp(admission.Create, &dashv2beta1.Notebook{}, nil), nil)

		require.EqualError(t, err, "mutation error: expected dashboard preferences, got *v2beta1.Notebook")
	})
}

// nilIfUnset reads a zero value as unset, so a plain bool or number member would make an object that
// sets it to false or 0 read as unset, and Mutate would drop it.
func TestDashboardPreferencesNilIfUnsetTypesHaveOnlyNillableMembers(t *testing.T) {
	// The types Mutate passes to nilIfUnset.
	types := []reflect.Type{
		reflect.TypeFor[dashv2beta1.DashboardPreferencesDashboardDefaults](),
		reflect.TypeFor[dashv2beta1.DashboardPreferencesV2beta1DashboardDefaultsAutoGrid](),
		reflect.TypeFor[dashv2beta1.DashboardPreferencesPanelDefaults](),
		reflect.TypeFor[dashv2beta1.DashboardPreferencesV2beta1PanelDefaultsLegend](),
		reflect.TypeFor[dashv2beta1.DashboardPreferencesV2beta1PanelDefaultsTooltip](),
		reflect.TypeFor[dashv2beta1.DashboardPreferencesV2beta1PanelDefaultsAxis](),
		reflect.TypeFor[dashv2beta1.DashboardPreferencesV2beta1PanelDefaultsGraph](),
		reflect.TypeFor[dashv2beta1.DashboardPreferencesV2beta1PanelDefaultsField](),
		reflect.TypeFor[dashv2beta1.DashboardPreferencesV2beta1PanelDefaultsFrame](),
	}
	for _, typ := range types {
		t.Run(typ.Name(), func(t *testing.T) {
			for field := range typ.Fields() {
				switch field.Type.Kind() {
				case reflect.Pointer, reflect.Slice, reflect.Map:
				default:
					t.Errorf("%s.%s is a %s, which nilIfUnset can't tell set from unset", typ.Name(), field.Name, field.Type)
				}
			}
		})
	}
}
