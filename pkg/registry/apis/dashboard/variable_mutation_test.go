package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	dashv2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestDashboardsAPIBuilderMutateVariable(t *testing.T) {
	builder := &DashboardsAPIBuilder{}

	v := newCustomVariable("region", "wrong-name")
	v.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-a"})
	require.Equal(t, "wrong-name", v.GetName())

	err := builder.Mutate(context.Background(), admission.NewAttributesRecord(
		v,
		nil,
		dashv2.VariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		v.GetName(),
		dashv2.VariableResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{},
		false,
		nil,
	), nil)

	require.NoError(t, err)
	require.Equal(t, "wrong-name", v.GetName())
	require.Equal(t, "folder-a", v.GetLabels()[variableFolderLabelKey])

	// Clearing folder annotation should remove the mirrored folder label.
	v.SetAnnotations(map[string]string{})
	err = builder.Mutate(context.Background(), admission.NewAttributesRecord(
		v,
		nil,
		dashv2.VariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		v.GetName(),
		dashv2.VariableResourceInfo.GroupVersionResource(),
		"",
		admission.Update,
		&metav1.UpdateOptions{},
		false,
		nil,
	), nil)
	require.NoError(t, err)
	require.NotContains(t, v.GetLabels(), variableFolderLabelKey)
}
