package dualwrite

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	k8srest "k8s.io/apiserver/pkg/registry/rest"
)

type versionCheckingDeleteStore struct {
	*fakeStorage
	version string
	seen    chan *metav1.DeleteOptions
}

func (s *versionCheckingDeleteStore) Delete(_ context.Context, name string, _ k8srest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	s.seen <- options.DeepCopy()
	if p := options.Preconditions; p != nil && p.ResourceVersion != nil && *p.ResourceVersion != s.version {
		return nil, false, apierrors.NewConflict(kind, name, errors.New("version mismatch"))
	}
	return exampleObj, true, nil
}

func TestDeleteChecksVersionOnlyInAuthoritativeStore(t *testing.T) {
	for _, tc := range []struct {
		name                               string
		unified, background, stale, dryRun bool
	}{
		{name: "legacy synchronous"},
		{name: "legacy background", background: true},
		{name: "legacy stale", stale: true},
		{name: "legacy stale background", stale: true, background: true},
		{name: "unified", unified: true},
		{name: "unified stale", unified: true, stale: true},
		{name: "dry run", dryRun: true},
		{name: "dry run stale", dryRun: true, stale: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			legacy := &versionCheckingDeleteStore{fakeStorage: &fakeStorage{}, version: "ds:7", seen: make(chan *metav1.DeleteOptions, 1)}
			unified := &versionCheckingDeleteStore{fakeStorage: &fakeStorage{}, version: "lbac:91", seen: make(chan *metav1.DeleteOptions, 1)}
			dw := &dualWriter{legacy: legacy, unified: unified, gr: kind, getMode: func(context.Context) (bool, bool) { return tc.unified, tc.background }}
			rv := legacy.version
			if tc.unified || tc.dryRun {
				rv = unified.version
			}
			if tc.stale {
				rv = "stale"
			}
			uid := types.UID("object-uid")
			propagation := metav1.DeletePropagationForeground
			options := &metav1.DeleteOptions{Preconditions: &metav1.Preconditions{ResourceVersion: &rv, UID: &uid}, PropagationPolicy: &propagation}
			if tc.dryRun {
				options.DryRun = []string{metav1.DryRunAll}
			}
			original := options.DeepCopy()
			_, _, err := dw.Delete(context.Background(), "object", nil, options)
			if tc.stale {
				require.True(t, apierrors.IsConflict(err))
			} else {
				require.NoError(t, err)
			}
			if tc.unified || tc.dryRun {
				require.Equal(t, original, <-unified.seen)
				require.Empty(t, legacy.seen)
			} else {
				require.Equal(t, original, <-legacy.seen)
				if tc.stale {
					require.Empty(t, unified.seen)
				} else {
					select {
					case seen := <-unified.seen:
						expected := original.DeepCopy()
						expected.Preconditions.ResourceVersion = nil
						require.Equal(t, expected, seen)
					case <-time.After(5 * time.Second):
						t.Fatal("mirror deletion did not run")
					}
				}
			}
			require.Equal(t, original, options, "caller options must not be mutated")
		})
	}
}
