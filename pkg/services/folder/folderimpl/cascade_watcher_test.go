package folderimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	foldersv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/registry/apis/folders"
	"github.com/grafana/grafana/pkg/services/apiserver"
)

func TestIsTerminatingForCascade(t *testing.T) {
	now := metav1.NewTime(time.Now())

	require.False(t, isTerminatingForCascade(&foldersv1.Folder{}))
	require.False(t, isTerminatingForCascade(&foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{DeletionTimestamp: &now},
	}))
	require.False(t, isTerminatingForCascade(&foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{Finalizers: []string{folders.CascadeDeleteFinalizer}},
	}))
	require.True(t, isTerminatingForCascade(&foldersv1.Folder{
		ObjectMeta: metav1.ObjectMeta{
			DeletionTimestamp: &now,
			Finalizers:        []string{folders.CascadeDeleteFinalizer},
		},
	}))
}

func TestCascadeWatcher_Run_withoutRestConfig(t *testing.T) {
	w := ProvideCascadeWatcher(apiserver.WithoutRestConfig)
	err := w.Run(context.Background())
	require.NoError(t, err)
}
