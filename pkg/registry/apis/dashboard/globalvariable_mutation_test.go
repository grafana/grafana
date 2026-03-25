package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestDashboardsAPIBuilderMutateGlobalVariable(t *testing.T) {
	builder := &DashboardsAPIBuilder{}

	gv := newCustomGlobalVariable("region", "wrong-name")
	gv.SetAnnotations(map[string]string{utils.AnnoKeyFolder: "folder-a"})
	require.Equal(t, "wrong-name", gv.GetName())

	err := builder.Mutate(context.Background(), admission.NewAttributesRecord(
		gv,
		nil,
		dashv2beta1.GlobalVariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		gv.GetName(),
		dashv2beta1.GlobalVariableResourceInfo.GroupVersionResource(),
		"",
		admission.Create,
		&metav1.CreateOptions{},
		false,
		nil,
	), nil)

	require.NoError(t, err)
	require.Equal(t, "wrong-name", gv.GetName())
	require.Equal(t, "folder-a", gv.GetLabels()[globalVariableFolderLabelKey])

	// Clearing folder annotation should remove the mirrored folder label.
	gv.SetAnnotations(map[string]string{})
	err = builder.Mutate(context.Background(), admission.NewAttributesRecord(
		gv,
		nil,
		dashv2beta1.GlobalVariableResourceInfo.GroupVersionKind(),
		"stacks-1",
		gv.GetName(),
		dashv2beta1.GlobalVariableResourceInfo.GroupVersionResource(),
		"",
		admission.Update,
		&metav1.UpdateOptions{},
		false,
		nil,
	), nil)
	require.NoError(t, err)
	require.NotContains(t, gv.GetLabels(), globalVariableFolderLabelKey)
}
