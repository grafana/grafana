package v1beta1

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/stretchr/testify/require"
)

type recordingClient struct {
	resource.Client
	obj  resource.Object
	opts resource.UpdateOptions
}

func (c *recordingClient) Update(_ context.Context, _ resource.Identifier, obj resource.Object, opts resource.UpdateOptions) (resource.Object, error) {
	c.obj, c.opts = obj, opts
	return obj, nil
}

func TestFolderClientUpdateStatus(t *testing.T) {
	rec := &recordingClient{}
	status := *NewFolderStatus()
	status.CascadeDelete = NewFolderCascadeDeleteStatus()
	status.CascadeDelete.State = FolderCascadeDeleteStatusStateInProgress

	_, err := NewFolderClient(rec).UpdateStatus(context.Background(),
		resource.Identifier{Namespace: "default", Name: "f1"}, status, resource.UpdateOptions{ResourceVersion: "7"})
	require.NoError(t, err)

	require.Equal(t, "status", rec.opts.Subresource)
	require.Equal(t, "7", rec.opts.ResourceVersion)
	sent, ok := rec.obj.(*Folder)
	require.True(t, ok)
	require.Equal(t, "folder.grafana.app/v1beta1", sent.APIVersion)
	require.Equal(t, "f1", sent.Name)
	require.Equal(t, "default", sent.Namespace)
	require.Equal(t, "7", sent.ResourceVersion)
	require.Equal(t, status, sent.Status)
}
