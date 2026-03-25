package dashboard

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

func TestDashboardsAPIBuilderMutateGlobalVariable(t *testing.T) {
	builder := &DashboardsAPIBuilder{}

	gv := newCustomGlobalVariable("region", "wrong-name")
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
}
