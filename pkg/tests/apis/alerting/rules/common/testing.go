package common

import (
	"context"
	"testing"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/stretchr/testify/require"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

func NewAlertRuleClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1.AlertRule, v0alpha1.AlertRuleList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1.AlertRule, v0alpha1.AlertRuleList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1.AlertRuleKind().Group(),
				Version:  v0alpha1.AlertRuleKind().Version(),
				Resource: v0alpha1.AlertRuleKind().Plural(),
			}).Namespace("default"),
	}
}

func NewRecordingRuleClient(t *testing.T, user apis.User) *apis.TypedClient[v0alpha1.RecordingRule, v0alpha1.RecordingRuleList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[v0alpha1.RecordingRule, v0alpha1.RecordingRuleList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    v0alpha1.RecordingRuleKind().Group(),
				Version:  v0alpha1.RecordingRuleKind().Version(),
				Resource: v0alpha1.RecordingRuleKind().Plural(),
			}).Namespace("default"),
	}
}

func NewFolderClient(t *testing.T, user apis.User) *apis.TypedClient[folders.Folder, folders.FolderList] {
	t.Helper()

	client, err := dynamic.NewForConfig(user.NewRestConfig())
	require.NoError(t, err)

	return &apis.TypedClient[folders.Folder, folders.FolderList]{
		Client: client.Resource(
			schema.GroupVersionResource{
				Group:    folders.FolderKind().Group(),
				Version:  folders.FolderKind().Version(),
				Resource: folders.FolderKind().Plural(),
			}).Namespace("default"),
	}
}

func GetTestHelper(t *testing.T) *apis.K8sTestHelper {
	return apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		EnableFeatureToggles: []string{
			"kubernetesAlertingRules",
		},
	})
}

func CreateTestFolder(t *testing.T, helper *apis.K8sTestHelper, folderUID string) {
	ctx := context.Background()
	folderClient := NewFolderClient(t, helper.Org1.Admin)

	folder := &folders.Folder{
		ObjectMeta: v1.ObjectMeta{
			Name:      folderUID,
			Namespace: "default",
		},
		Spec: folders.FolderSpec{
			Title: "Test Folder",
		},
	}

	_, err := folderClient.Create(ctx, folder, v1.CreateOptions{})
	require.NoError(t, err)
}
