package datasource

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestDataSourceCreateAdmission(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	apiBuilder := &DataSourceAPIBuilder{datasourceResourceInfo: resourceInfo}
	admissionPlugin := builder.NewAdmissionFromBuilders([]builder.APIGroupBuilder{apiBuilder})

	tests := []struct {
		name      string
		spec      map[string]any
		wantField string
	}{
		{name: "no jsonData", spec: map[string]any{}},
		{name: "null jsonData", spec: map[string]any{"jsonData": nil}},
		{name: "unrelated jsonData", spec: map[string]any{"jsonData": map[string]any{"httpMethod": "POST"}}},
		{name: "headers", spec: map[string]any{"jsonData": map[string]any{"teamHttpHeaders": map[string]any{"secret": "sensitive-value"}}}, wantField: "spec.jsonData.teamHttpHeaders"},
		{name: "null headers", spec: map[string]any{"jsonData": map[string]any{"teamHttpHeaders": nil}}, wantField: "spec.jsonData.teamHttpHeaders"},
		{name: "empty headers", spec: map[string]any{"jsonData": map[string]any{"teamHttpHeaders": map[string]any{}}}, wantField: "spec.jsonData.teamHttpHeaders"},
		{name: "empty header list", spec: map[string]any{"jsonData": map[string]any{"teamHttpHeaders": []any{}}}, wantField: "spec.jsonData.teamHttpHeaders"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ds := &datasourceV0.DataSource{
				ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"},
				Spec:       datasourceV0.UnstructuredSpec{Object: tt.spec},
			}
			attrs := admission.NewAttributesRecord(
				ds, nil, resourceInfo.GroupVersionKind(), ds.Namespace, ds.Name,
				resourceInfo.GroupVersionResource(), "", admission.Create, &metav1.CreateOptions{}, false, nil,
			)
			err := admissionPlugin.Admit(context.Background(), attrs, nil)
			if tt.wantField == "" {
				require.NoError(t, err)
				return
			}
			require.True(t, apierrors.IsInvalid(err), "expected an invalid-object response: %v", err)
			status := err.(*apierrors.StatusError).ErrStatus
			require.Equal(t, tt.wantField, status.Details.Causes[0].Field)
			require.Contains(t, err.Error(), "TeamLBACRule")
			require.NotContains(t, err.Error(), "sensitive-value")
		})
	}

	ds := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"},
		Spec: datasourceV0.UnstructuredSpec{Object: map[string]any{
			"jsonData": map[string]any{"teamHttpHeaders": map[string]any{}},
		}},
	}
	for _, tt := range []struct {
		name        string
		operation   admission.Operation
		resource    string
		subresource string
	}{
		{name: "update is outside create guard", operation: admission.Update, resource: resourceInfo.GetName()},
		{name: "other resource is outside create guard", operation: admission.Create, resource: "querytypes"},
		{name: "connect subresource is outside create guard", operation: admission.Connect, resource: resourceInfo.GetName(), subresource: "query"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			gvr := resourceInfo.GroupVersionResource()
			gvr.Resource = tt.resource
			attrs := admission.NewAttributesRecord(
				ds, nil, resourceInfo.GroupVersionKind(), ds.Namespace, ds.Name,
				gvr, tt.subresource, tt.operation, &metav1.CreateOptions{}, false, nil,
			)
			require.NoError(t, admissionPlugin.Admit(context.Background(), attrs, nil))
		})
	}
}

func TestDataSourceCreateAdmissionFlagDisabled(t *testing.T) {
	featuremgmt.WithDisabledFlags(t, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard)
	resourceInfo := datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("prometheus.datasource.grafana.app", "prometheus")
	apiBuilder := &DataSourceAPIBuilder{datasourceResourceInfo: resourceInfo}
	admissionPlugin := builder.NewAdmissionFromBuilders([]builder.APIGroupBuilder{apiBuilder})
	ds := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{Name: "example", Namespace: "default"},
		Spec: datasourceV0.UnstructuredSpec{Object: map[string]any{
			"jsonData": map[string]any{"teamHttpHeaders": map[string]any{}},
		}},
	}
	attrs := admission.NewAttributesRecord(
		ds, nil, resourceInfo.GroupVersionKind(), ds.Namespace, ds.Name,
		resourceInfo.GroupVersionResource(), "", admission.Create, &metav1.CreateOptions{}, false, nil,
	)
	require.NoError(t, admissionPlugin.Admit(context.Background(), attrs, nil))
}
