package apistore_test

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"

	arq "github.com/grafana/grafana/apps/alerting/alertrulequality/pkg/apis/alertrulequality/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestStorageGetLegacyAlertRuleQualityPolicy(t *testing.T) {
	scheme := runtime.NewScheme()
	scheme.AddKnownTypes(arq.GroupVersion, &arq.AlertRuleQualityPolicy{}, &arq.AlertRuleQualityPolicyList{})
	metav1.AddToGroupVersion(scheme, arq.GroupVersion)
	codecs := serializer.NewCodecFactory(scheme)
	config := storagebackend.NewDefaultConfig("", codecs.LegacyCodec(arq.GroupVersion))
	groupResource := arq.GroupVersion.WithResource("alert-rule-quality-policies").GroupResource()

	client := resource.NewMockResourceClient(t)
	client.EXPECT().Read(mock.Anything, &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: "stacks-1",
			Group:     arq.APIGroup,
			Resource:  groupResource.Resource,
			Name:      "default",
		},
	}).Return(&resourcepb.ReadResponse{
		ResourceVersion: 42,
		Value: []byte(`{
			"apiVersion": "alertrulequality.alerting.grafana.app/v0alpha1",
			"kind": "AlertRuleQualityPolicy",
			"metadata": {"name": "default", "namespace": "stacks-1", "resourceVersion": "1"},
			"spec": {
				"requiredAnnotations": ["summary", "runbook_url"],
				"requiredLabels": ["team"]
			}
		}`),
	}, nil).Once()

	store, destroy, err := apistore.NewStorage(
		config.ForResource(groupResource),
		client,
		nil,
		nil,
		func() runtime.Object { return &arq.AlertRuleQualityPolicy{} },
		func() runtime.Object { return &arq.AlertRuleQualityPolicyList{} },
		storage.DefaultNamespaceScopedAttr,
		nil,
		nil,
		nil,
		apistore.StorageOptions{},
	)
	require.NoError(t, err)
	t.Cleanup(destroy)

	var policy arq.AlertRuleQualityPolicy
	err = store.Get(t.Context(), "/group/alertrulequality.alerting.grafana.app/resource/alert-rule-quality-policies/namespace/stacks-1/name/default", storage.GetOptions{}, &policy)
	require.NoError(t, err)
	require.Equal(t, "default", policy.Name)
	require.Equal(t, "stacks-1", policy.Namespace)
	require.Equal(t, "42", policy.ResourceVersion)
	require.Equal(t, arq.AlertRuleQualityPolicySpec{
		RequiredAnnotations: []arq.FieldRequirement{{Key: "summary", Enforce: true}, {Key: "runbook_url", Enforce: true}},
		RequiredLabels:      []arq.FieldRequirement{{Key: "team", Enforce: true}},
	}, policy.Spec)
}
