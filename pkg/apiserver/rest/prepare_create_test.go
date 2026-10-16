package rest

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestWithPrepareCreate(t *testing.T) {
	original := &metav1.PartialObjectMetadata{ObjectMeta: metav1.ObjectMeta{Name: "original"}}
	storage := NewMockStorage(t)
	storage.On("Create", mock.Anything, mock.MatchedBy(func(obj runtime.Object) bool {
		return obj.(*metav1.PartialObjectMetadata).Name == "prepared" && obj != original
	}), mock.Anything, mock.Anything).Return(original, nil).Once()

	prepared := false
	wrapped := WithPrepareCreate(storage, func(_ context.Context, obj runtime.Object, _ *metav1.CreateOptions) error {
		prepared = true
		obj.(*metav1.PartialObjectMetadata).Name = "prepared"
		return nil
	})
	result, err := wrapped.Create(context.Background(), original, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	require.True(t, prepared)
	require.Same(t, original, result)
	require.Equal(t, "original", original.Name)
}

func TestWithPrepareCreateFailureSkipsCreate(t *testing.T) {
	storage := NewMockStorage(t)
	wrapped := WithPrepareCreate(storage, func(_ context.Context, _ runtime.Object, _ *metav1.CreateOptions) error {
		return errors.New("prepare failed")
	})
	_, err := wrapped.Create(context.Background(), &metav1.PartialObjectMetadata{}, nil, &metav1.CreateOptions{})
	require.ErrorContains(t, err, "prepare failed")
}
