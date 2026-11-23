package team

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/team/teamdelete"
)

type fakeTeamStorage struct {
	grafanarest.Storage
	deletes   int
	deleteErr error
	notDone   bool
	getErr    error
}

func (s *fakeTeamStorage) Get(context.Context, string, *metav1.GetOptions) (runtime.Object, error) {
	if s.getErr != nil {
		return nil, s.getErr
	}
	t := &iamv0.Team{ObjectMeta: metav1.ObjectMeta{Name: "uid-1", Namespace: "default"}}
	meta, err := utils.MetaAccessor(t)
	if err != nil {
		return nil, err
	}
	meta.SetDeprecatedInternalID(7) // nolint:staticcheck
	return t, nil
}

func (s *fakeTeamStorage) Delete(context.Context, string, rest.ValidateObjectFunc, *metav1.DeleteOptions) (runtime.Object, bool, error) {
	s.deletes++
	return &iamv0.Team{}, !s.notDone, s.deleteErr
}

type fakeWatchTeamStorage struct {
	fakeTeamStorage
	rest.Watcher
}

type fakeMetaTeamStorage struct {
	fakeWatchTeamStorage
	registryMetadata
}

func TestWithDeletedHandlers(t *testing.T) {
	ctx := genericapirequest.WithNamespace(context.Background(), "default")
	missing := apierrors.NewNotFound(schema.GroupResource{Resource: "teams"}, "uid-1")

	tests := []struct {
		name    string
		store   fakeTeamStorage
		options *metav1.DeleteOptions
		want    []teamdelete.Deleted
		wantErr error
	}{
		{name: "success", want: []teamdelete.Deleted{{OrgID: 1, TeamID: 7, TeamUID: "uid-1"}}},
		{name: "unreadable team still runs with the UID", store: fakeTeamStorage{getErr: missing}, want: []teamdelete.Deleted{{OrgID: 1, TeamUID: "uid-1"}}},
		{name: "failed delete", store: fakeTeamStorage{deleteErr: missing}, wantErr: missing},
		{name: "delete not completed", store: fakeTeamStorage{notDone: true}},
		{name: "dry run", options: &metav1.DeleteOptions{DryRun: []string{metav1.DryRunAll}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			registry := teamdelete.ProvideDeletedRegistry()
			var got []teamdelete.Deleted
			for range 2 {
				registry.RegisterDeleted(func(_ context.Context, d teamdelete.Deleted) error {
					got = append(got, d)
					return nil
				})
			}
			store := tt.store
			wrapped := WithDeletedHandlers(&store, registry)

			options := tt.options
			if options == nil {
				options = &metav1.DeleteOptions{}
			}
			_, _, err := wrapped.Delete(ctx, "uid-1", nil, options)
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
			} else {
				require.NoError(t, err)
			}
			// One delete reaches the inner storage and every handler runs once for it.
			require.Equal(t, 1, store.deletes)
			var want []teamdelete.Deleted
			for range tt.want {
				want = append(want, tt.want[0], tt.want[0])
			}
			require.Equal(t, want, got)
		})
	}
}

func TestWithDeletedHandlersFailingHandlersDoNotFailDelete(t *testing.T) {
	registry := teamdelete.ProvideDeletedRegistry()
	var ran []string
	registry.RegisterDeleted(func(context.Context, teamdelete.Deleted) error {
		ran = append(ran, "error")
		return errors.New("handler failed")
	})
	registry.RegisterDeleted(func(context.Context, teamdelete.Deleted) error {
		ran = append(ran, "panic")
		panic("boom")
	})
	registry.RegisterDeleted(func(context.Context, teamdelete.Deleted) error {
		ran = append(ran, "after")
		return nil
	})
	wrapped := WithDeletedHandlers(&fakeTeamStorage{}, registry)

	ctx := genericapirequest.WithNamespace(context.Background(), "default")
	_, deleted, err := wrapped.Delete(ctx, "uid-1", nil, &metav1.DeleteOptions{})
	require.NoError(t, err)
	require.True(t, deleted)
	require.Equal(t, []string{"error", "panic", "after"}, ran)
}

func TestWithDeletedHandlersKeepsWatch(t *testing.T) {
	registry := teamdelete.ProvideDeletedRegistry()

	_, ok := WithDeletedHandlers(&fakeTeamStorage{}, registry).(rest.Watcher)
	require.False(t, ok)
	_, ok = WithDeletedHandlers(&fakeWatchTeamStorage{}, registry).(rest.Watcher)
	require.True(t, ok)
	inner := &fakeTeamStorage{}
	require.Same(t, inner, WithDeletedHandlers(inner, nil))
}

func TestWithDeletedHandlersKeepsRegistryMetadata(t *testing.T) {
	registry := teamdelete.ProvideDeletedRegistry()

	_, ok := WithDeletedHandlers(&fakeWatchTeamStorage{}, registry).(registryMetadata)
	require.False(t, ok)

	wrapped := WithDeletedHandlers(&fakeMetaTeamStorage{}, registry)
	_, ok = wrapped.(registryMetadata)
	require.True(t, ok)
	_, ok = wrapped.(rest.Watcher)
	require.True(t, ok)
	_, ok = wrapped.(rest.CollectionDeleter)
	require.False(t, ok)

	// The roster store keeps the metadata of the wrapped storage.
	_, ok = NewRosterStore(wrapped, nil, nil, nil).(registryMetadata)
	require.True(t, ok)
}
