package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type fakeRegistry struct {
	deleted   []string
	remaining int64
	delErr    error
	countErr  error
}

func (f *fakeRegistry) DeleteInFolders(_ context.Context, _ int64, uids []string, _ identity.Requester) error {
	f.deleted = append(f.deleted, uids...)
	return f.delErr
}

func (f *fakeRegistry) CountInFolders(_ context.Context, _ int64, _ []string, _ identity.Requester) (int64, error) {
	return f.remaining, f.countErr
}

func (f *fakeRegistry) Kind() string { return "dashboard" }

func TestFolderConsumer_DeleteInFolder(t *testing.T) {
	t.Run("succeeds when the folder is empty afterwards", func(t *testing.T) {
		reg := &fakeRegistry{remaining: 0}
		c := &FolderConsumer{svc: reg}
		require.NoError(t, c.DeleteInFolder(context.Background(), 1, "f1"))
		require.Equal(t, []string{"f1"}, reg.deleted)
	})

	t.Run("errors when dashboards remain, so the finalizer is kept", func(t *testing.T) {
		reg := &fakeRegistry{remaining: 2}
		c := &FolderConsumer{svc: reg}
		require.ErrorContains(t, c.DeleteInFolder(context.Background(), 1, "f1"), "still present")
	})

	t.Run("propagates the delete error", func(t *testing.T) {
		reg := &fakeRegistry{delErr: errors.New("boom")}
		c := &FolderConsumer{svc: reg}
		require.ErrorContains(t, c.DeleteInFolder(context.Background(), 1, "f1"), "boom")
	})
}
