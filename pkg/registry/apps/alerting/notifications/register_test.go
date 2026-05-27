package notifications

import (
	"testing"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	v0alpha1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v0alpha1"
	v1beta1 "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
)

func newTestScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	scheme := runtime.NewScheme()

	gv0 := v0alpha1.RoutingTreeKind().GroupVersionKind().GroupVersion()
	gv1 := v1beta1.RoutingTreeKind().GroupVersionKind().GroupVersion()

	scheme.AddKnownTypes(gv0,
		&v0alpha1.ReceiverList{},
		&v0alpha1.InhibitionRuleList{},
		&v0alpha1.RoutingTreeList{},
		&v0alpha1.TemplateGroupList{},
		&v0alpha1.TimeIntervalList{},
	)
	scheme.AddKnownTypes(gv1,
		&v1beta1.ReceiverList{},
		&v1beta1.InhibitionRuleList{},
		&v1beta1.RoutingTreeList{},
		&v1beta1.TemplateGroupList{},
		&v1beta1.TimeIntervalList{},
	)
	metav1.AddToGroupVersion(scheme, gv0)
	metav1.AddToGroupVersion(scheme, gv1)

	require.NoError(t, registerListConversions(scheme))
	return scheme
}

func TestRegisterListConversions_ItemTypeMetaIsUpdated(t *testing.T) {
	scheme := newTestScheme(t)

	v1beta1GV := v1beta1.RoutingTreeKind().GroupVersionKind().GroupVersion()
	v0alpha1GV := v0alpha1.RoutingTreeKind().GroupVersionKind().GroupVersion()

	t.Run("v1beta1 RoutingTreeList to v0alpha1 sets item TypeMeta", func(t *testing.T) {
		inList := &v1beta1.RoutingTreeList{
			Items: []v1beta1.RoutingTree{
				{TypeMeta: metav1.TypeMeta{APIVersion: v1beta1GV.String(), Kind: "RoutingTree"}},
				{TypeMeta: metav1.TypeMeta{APIVersion: v1beta1GV.String(), Kind: "RoutingTree"}},
			},
		}

		out, err := scheme.ConvertToVersion(inList, v0alpha1GV)
		require.NoError(t, err)

		outList, ok := out.(*v0alpha1.RoutingTreeList)
		require.True(t, ok)
		require.Len(t, outList.Items, 2)
		for _, item := range outList.Items {
			assert.Equal(t, v0alpha1GV.String(), item.APIVersion)
			assert.Equal(t, "RoutingTree", item.Kind)
		}
	})

	t.Run("v0alpha1 RoutingTreeList to v1beta1 sets item TypeMeta", func(t *testing.T) {
		inList := &v0alpha1.RoutingTreeList{
			Items: []v0alpha1.RoutingTree{
				{TypeMeta: metav1.TypeMeta{APIVersion: v0alpha1GV.String(), Kind: "RoutingTree"}},
			},
		}

		out, err := scheme.ConvertToVersion(inList, v1beta1GV)
		require.NoError(t, err)

		outList, ok := out.(*v1beta1.RoutingTreeList)
		require.True(t, ok)
		require.Len(t, outList.Items, 1)
		assert.Equal(t, v1beta1GV.String(), outList.Items[0].APIVersion)
		assert.Equal(t, "RoutingTree", outList.Items[0].Kind)
	})

	t.Run("converted items do not alias input slice", func(t *testing.T) {
		inList := &v1beta1.RoutingTreeList{
			Items: []v1beta1.RoutingTree{
				{TypeMeta: metav1.TypeMeta{APIVersion: v1beta1GV.String(), Kind: "RoutingTree"}},
			},
		}

		out, err := scheme.ConvertToVersion(inList, v0alpha1GV)
		require.NoError(t, err)

		outList := out.(*v0alpha1.RoutingTreeList)
		// Mutating the output should not affect the input.
		outList.Items[0].Name = "mutated"
		assert.Empty(t, inList.Items[0].Name)
	})
}

func TestRegisterListConversions_ListMetaIsPreserved(t *testing.T) {
	scheme := newTestScheme(t)

	v0alpha1GV := v0alpha1.RoutingTreeKind().GroupVersionKind().GroupVersion()

	inList := &v1beta1.RoutingTreeList{
		ListMeta: metav1.ListMeta{
			ResourceVersion: "42",
			Continue:        "tok",
		},
	}

	out, err := scheme.ConvertToVersion(inList, v0alpha1GV)
	require.NoError(t, err)

	outList := out.(*v0alpha1.RoutingTreeList)
	assert.Equal(t, "42", outList.ResourceVersion)
	assert.Equal(t, "tok", outList.Continue)
}
