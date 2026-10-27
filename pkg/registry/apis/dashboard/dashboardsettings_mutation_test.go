package dashboard

import (
	"context"
	"encoding/json"
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

func newDashboardSettings(name, folderUID string, userUID *string) *dashv2beta1.DashboardSettings {
	obj := &dashv2beta1.DashboardSettings{Spec: dashv2beta1.DashboardSettingsSpec{UserUID: userUID}}
	obj.SetName(name)
	if folderUID != "" {
		obj.SetAnnotations(map[string]string{utils.AnnoKeyFolder: folderUID})
	}
	return obj
}

// The objects are untyped so an absent one is a real nil: a nil *DashboardSettings held in a
// runtime.Object is not == nil, so an Update with no old object would appear to carry one. It also
// lets a row pass another kind.
func dashboardSettingsAttributesForOp(op admission.Operation, newObj, oldObj runtime.Object) admission.Attributes {
	switch op {
	case admission.Create:
		return admission.NewAttributesRecord(
			newObj,
			nil,
			dashv2beta1.DashboardSettingsResourceInfo.GroupVersionKind(),
			"stacks-1",
			newObj.(metav1.Object).GetName(),
			dashv2beta1.DashboardSettingsResourceInfo.GroupVersionResource(),
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
			dashv2beta1.DashboardSettingsResourceInfo.GroupVersionKind(),
			"stacks-1",
			newObj.(metav1.Object).GetName(),
			dashv2beta1.DashboardSettingsResourceInfo.GroupVersionResource(),
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
			dashv2beta1.DashboardSettingsResourceInfo.GroupVersionKind(),
			"stacks-1",
			oldObj.(metav1.Object).GetName(),
			dashv2beta1.DashboardSettingsResourceInfo.GroupVersionResource(),
			"",
			admission.Delete,
			&metav1.DeleteOptions{},
			false,
			nil,
		)
	}
}

func TestDashboardsAPIBuilderMutateDashboardSettings(t *testing.T) {
	builder := &DashboardsAPIBuilder{}
	ctx := context.Background()

	mutate := func(op admission.Operation, obj *dashv2beta1.DashboardSettings) error {
		return builder.Mutate(ctx, dashboardSettingsAttributesForOp(op, obj, nil), nil)
	}
	withLabels := func(obj *dashv2beta1.DashboardSettings, labels map[string]string) *dashv2beta1.DashboardSettings {
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

	orgLabels := map[string]string{dashboardSettingsTierLabelKey: "org"}
	userLabels := map[string]string{dashboardSettingsTierLabelKey: "user"}
	folderLabels := map[string]string{dashboardSettingsTierLabelKey: "folder"}

	t.Run("name and labels follow the scope", func(t *testing.T) {
		tests := []struct {
			name       string
			op         admission.Operation
			obj        *dashv2beta1.DashboardSettings
			wantName   string
			wantLabels map[string]string
		}{
			{name: "folder create without name", op: admission.Create, obj: newDashboardSettings("", "f1", nil), wantName: "folder-f1", wantLabels: folderLabels},
			// A label value must start and end with an alphanumeric character and a folder UID need not, so
			// the UID cannot be copied into a label.
			{name: "folder create with a UID that starts with an underscore", op: admission.Create, obj: newDashboardSettings("", "_lead", nil), wantName: "folder-_lead", wantLabels: folderLabels},
			{name: "folder create with a UID that ends with a dash", op: admission.Create, obj: newDashboardSettings("", "trail-", nil), wantName: "folder-trail-", wantLabels: folderLabels},
			{name: "org create without name", op: admission.Create, obj: newDashboardSettings("", "", nil), wantName: "namespace", wantLabels: orgLabels},
			{name: "general folder create", op: admission.Create, obj: newDashboardSettings("", "general", nil), wantName: "namespace", wantLabels: orgLabels},
			{name: "user create", op: admission.Create, obj: newDashboardSettings("", "", new("u1")), wantName: "user-u1", wantLabels: userLabels},
			{name: "user create in the general folder", op: admission.Create, obj: newDashboardSettings("", "general", new("u1")), wantName: "user-u1", wantLabels: userLabels},
			{name: "provided name kept", op: admission.Create, obj: newDashboardSettings("folder-f1", "f1", nil), wantName: "folder-f1", wantLabels: folderLabels},
			// Validate owns the name check, so a name that does not fit the scope has to reach it unchanged.
			{name: "provided name that does not fit the scope kept", op: admission.Create, obj: newDashboardSettings("folder-f2", "f1", nil), wantName: "folder-f2", wantLabels: folderLabels},
			{name: "name not derived on update", op: admission.Update, obj: newDashboardSettings("", "f1", nil), wantName: "", wantLabels: folderLabels},
			{
				name:       "annotation removed on update",
				op:         admission.Update,
				obj:        withLabels(newDashboardSettings("namespace", "", nil), map[string]string{dashboardSettingsFolderLabelKey: "f1"}),
				wantName:   "namespace",
				wantLabels: orgLabels,
			},
			// Root-parented objects can carry the general sentinel, so an update can arrive with it.
			{
				name:       "general annotation on update",
				op:         admission.Update,
				obj:        withLabels(newDashboardSettings("namespace", "general", nil), map[string]string{dashboardSettingsFolderLabelKey: "f1"}),
				wantName:   "namespace",
				wantLabels: orgLabels,
			},
			// List finds folder-tier objects by the tier label, so a client must not get to choose it.
			{
				name: "labels the server owns are rewritten and the rest kept",
				op:   admission.Create,
				obj: withLabels(newDashboardSettings("", "", new("u1")), map[string]string{
					dashboardSettingsTierLabelKey:   "folder",
					dashboardSettingsFolderLabelKey: "f1",
					"team":                          "a",
				}),
				wantName:   "user-u1",
				wantLabels: map[string]string{dashboardSettingsTierLabelKey: "user", "team": "a"},
			},
			// Nothing here sets the folder label, so one a client sends has to go on the folder tier too.
			{
				name:       "folder label sent by the client removed on the folder tier",
				op:         admission.Create,
				obj:        withLabels(newDashboardSettings("", "f1", nil), map[string]string{dashboardSettingsFolderLabelKey: "f2"}),
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

	t.Run("a spec naming both scopes is a bad request", func(t *testing.T) {
		tests := []struct {
			name string
			op   admission.Operation
			obj  *dashv2beta1.DashboardSettings
		}{
			{name: "create without name", op: admission.Create, obj: newDashboardSettings("", "f1", new("u1"))},
			{name: "update", op: admission.Update, obj: newDashboardSettings("folder-f1", "f1", new("u1"))},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := mutate(tt.op, tt.obj)

				require.True(t, apierrors.IsBadRequest(err), "expected a BadRequest, got %v", err)
				require.ErrorContains(t, err, "not both")
			})
		}
	})

	t.Run("panels", func(t *testing.T) {
		tests := []struct{ name, spec, want string }{
			{"empty panels dropped", `{"panels":{}}`, `{}`},
			{"rest of the spec kept when empty panels are dropped", `{"preload":false,"panels":{}}`, `{"preload":false}`},
			{"width alone kept", `{"panels":{"width":2}}`, `{"panels":{"width":2}}`},
			{"legend placement alone kept", `{"panels":{"legendPlacement":"right"}}`, `{"panels":{"legendPlacement":"right"}}`},
			{"tooltip mode alone kept", `{"panels":{"tooltipMode":"none"}}`, `{"panels":{"tooltipMode":"none"}}`},
			{"axis scale alone kept", `{"panels":{"axisScale":"log2"}}`, `{"panels":{"axisScale":"log2"}}`},
			// A set zero is a value, not an absence.
			{"decimals of zero alone kept", `{"panels":{"decimals":0}}`, `{"panels":{"decimals":0}}`},
		}
		for _, tt := range tests {
			for _, o := range ops {
				t.Run(tt.name+" on "+o.name, func(t *testing.T) {
					obj := newDashboardSettings("namespace", "", nil)
					require.NoError(t, json.Unmarshal([]byte(tt.spec), &obj.Spec))

					require.NoError(t, mutate(o.op, obj))

					got, err := json.Marshal(obj.Spec)
					require.NoError(t, err)
					require.JSONEq(t, tt.want, string(got))
				})
			}
		}
	})

	t.Run("finalizers and owner references are cleared", func(t *testing.T) {
		for _, o := range ops {
			t.Run(o.name, func(t *testing.T) {
				obj := newDashboardSettings("user-u1", "", new("u1"))
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
		old := newDashboardSettings("user-u1", "", new("u1"))
		old.SetFinalizers([]string{"keep"})

		require.NoError(t, builder.Mutate(ctx, dashboardSettingsAttributesForOp(admission.Delete, nil, old), nil))

		require.Equal(t, []string{"keep"}, old.GetFinalizers())
		require.Empty(t, old.GetLabels())
	})

	t.Run("rejects another object type", func(t *testing.T) {
		err := builder.Mutate(ctx, dashboardSettingsAttributesForOp(admission.Create, &dashv2beta1.Notebook{}, nil), nil)

		require.EqualError(t, err, "mutation error: expected dashboard settings, got *v2beta1.Notebook")
	})
}
