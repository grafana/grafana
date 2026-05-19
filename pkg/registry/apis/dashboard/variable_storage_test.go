package dashboard

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/services/apiserver/client"
)

func TestVariableStorageCreate(t *testing.T) {
	ctx := context.Background()
	createdTime := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)

	buildCreatedVariable := func() runtime.Object {
		return newCreatedVariable("region", "region-created", "uid-created", "42", "", createdTime)
	}

	t.Run("happy path: no duplicate, returns created object and does not call Delete", func(t *testing.T) {
		handler := &client.MockK8sHandler{}
		handler.On("List", mock.Anything, int64(1), mock.Anything).
			Return(&unstructured.UnstructuredList{
				Items: []unstructured.Unstructured{
					makeVariableListItem("region-created", "uid-created", "", createdTime),
				},
			}, nil).Once()

		calls := &storeCallRecorder{}
		s := &variableStorage{
			provider:    &staticHandlerProvider{handler: handler},
			innerCreate: calls.create(buildCreatedVariable(), nil),
			innerDelete: calls.delete(nil, false, nil),
		}

		out, err := s.Create(ctx, buildCreatedVariable(), nil, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, out)
		require.Equal(t, 1, calls.createCount)
		require.Equal(t, 0, calls.deleteCount)
		handler.AssertExpectations(t)
	})

	t.Run("lost race: deletes self with UID precondition and returns AlreadyExists", func(t *testing.T) {
		// Created object has a later timestamp than the winner, so it loses
		// the tie-break.
		loser := newCreatedVariable("region", "region-loser", "uid-loser", "42", "", createdTime.Add(time.Second))
		handler := &client.MockK8sHandler{}
		handler.On("List", mock.Anything, int64(1), mock.Anything).
			Return(&unstructured.UnstructuredList{
				Items: []unstructured.Unstructured{
					makeVariableListItem("region-loser", "uid-loser", "", createdTime.Add(time.Second)),
					makeVariableListItem("region-winner", "uid-winner", "", createdTime),
				},
			}, nil).Once()

		calls := &storeCallRecorder{}
		s := &variableStorage{
			provider:    &staticHandlerProvider{handler: handler},
			innerCreate: calls.create(loser, nil),
			innerDelete: calls.delete(nil, true, nil),
		}

		out, err := s.Create(ctx, loser, nil, &metav1.CreateOptions{})
		require.Nil(t, out)
		require.Error(t, err)
		require.True(t, apierrors.IsAlreadyExists(err))
		require.Equal(t, 1, calls.deleteCount)
		require.Equal(t, "region-loser", calls.lastDeleteName)
		require.NotNil(t, calls.lastDeleteOptions)
		require.NotNil(t, calls.lastDeleteOptions.Preconditions)
		require.NotNil(t, calls.lastDeleteOptions.Preconditions.UID)
		require.Equal(t, types.UID("uid-loser"), *calls.lastDeleteOptions.Preconditions.UID)
	})

	t.Run("delete failure on lost race: still returns AlreadyExists", func(t *testing.T) {
		loser := newCreatedVariable("region", "region-loser", "uid-loser", "42", "", createdTime.Add(time.Second))
		handler := &client.MockK8sHandler{}
		handler.On("List", mock.Anything, int64(1), mock.Anything).
			Return(&unstructured.UnstructuredList{
				Items: []unstructured.Unstructured{
					makeVariableListItem("region-loser", "uid-loser", "", createdTime.Add(time.Second)),
					makeVariableListItem("region-winner", "uid-winner", "", createdTime),
				},
			}, nil).Once()

		calls := &storeCallRecorder{}
		s := &variableStorage{
			provider:    &staticHandlerProvider{handler: handler},
			innerCreate: calls.create(loser, nil),
			innerDelete: calls.delete(nil, false, errors.New("delete failed")),
		}

		out, err := s.Create(ctx, loser, nil, &metav1.CreateOptions{})
		require.Nil(t, out)
		require.True(t, apierrors.IsAlreadyExists(err))
		require.Equal(t, 1, calls.deleteCount)
	})

	t.Run("list failure: degrades to admission-only and keeps created object", func(t *testing.T) {
		handler := &client.MockK8sHandler{}
		handler.On("List", mock.Anything, int64(1), mock.Anything).
			Return(nil, errors.New("list failed")).Once()

		calls := &storeCallRecorder{}
		s := &variableStorage{
			provider:    &staticHandlerProvider{handler: handler},
			innerCreate: calls.create(buildCreatedVariable(), nil),
			innerDelete: calls.delete(nil, false, nil),
		}

		out, err := s.Create(ctx, buildCreatedVariable(), nil, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, out)
		require.Equal(t, 0, calls.deleteCount, "list failure must not trigger a delete")
	})

	t.Run("underlying create error is surfaced verbatim", func(t *testing.T) {
		createErr := errors.New("storage boom")
		calls := &storeCallRecorder{}
		s := &variableStorage{
			innerCreate: calls.create(nil, createErr),
			innerDelete: calls.delete(nil, false, nil),
		}

		out, err := s.Create(ctx, buildCreatedVariable(), nil, &metav1.CreateOptions{})
		require.Nil(t, out)
		require.ErrorIs(t, err, createErr)
		require.Equal(t, 0, calls.deleteCount)
	})

	t.Run("dry-run skips the post-create verification", func(t *testing.T) {
		handler := &client.MockK8sHandler{}
		// No expectations set: List must not be called.

		calls := &storeCallRecorder{}
		s := &variableStorage{
			provider:    &staticHandlerProvider{handler: handler},
			innerCreate: calls.create(buildCreatedVariable(), nil),
			innerDelete: calls.delete(nil, false, nil),
		}

		out, err := s.Create(ctx, buildCreatedVariable(), nil, &metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}})
		require.NoError(t, err)
		require.NotNil(t, out)
		handler.AssertNotCalled(t, "List", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("nil provider short-circuits verification", func(t *testing.T) {
		calls := &storeCallRecorder{}
		s := &variableStorage{
			provider:    nil,
			innerCreate: calls.create(buildCreatedVariable(), nil),
			innerDelete: calls.delete(nil, false, nil),
		}

		out, err := s.Create(ctx, buildCreatedVariable(), nil, &metav1.CreateOptions{})
		require.NoError(t, err)
		require.NotNil(t, out)
	})
}

// storeCallRecorder records Create and Delete calls made against the wrapped
// storage and produces the function-typed fields used by variableStorage in
// tests. Using a recorder keeps the test wiring compact while letting us
// assert on parameters passed into the inner Delete (the UID precondition
// is load-bearing).
type storeCallRecorder struct {
	createCount       int
	deleteCount       int
	lastDeleteName    string
	lastDeleteOptions *metav1.DeleteOptions
}

func (r *storeCallRecorder) create(obj runtime.Object, err error) func(context.Context, runtime.Object, rest.ValidateObjectFunc, *metav1.CreateOptions) (runtime.Object, error) {
	return func(_ context.Context, _ runtime.Object, _ rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
		r.createCount++
		return obj, err
	}
}

func (r *storeCallRecorder) delete(obj runtime.Object, immediate bool, err error) func(context.Context, string, rest.ValidateObjectFunc, *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return func(_ context.Context, name string, _ rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
		r.deleteCount++
		r.lastDeleteName = name
		r.lastDeleteOptions = options
		return obj, immediate, err
	}
}
