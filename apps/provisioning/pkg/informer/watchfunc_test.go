package informer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestNotImplemented(t *testing.T) {
	w, err := NotImplemented(context.Background(), schema.GroupVersionResource{Resource: "things"}, "ns", metav1.ListOptions{})
	assert.Nil(t, w)
	require.ErrorIs(t, err, ErrNotImplemented)
}

// NotImplemented must satisfy the WatchFunc type so it can be passed wherever a
// WatchFunc is expected.
var _ WatchFunc = NotImplemented
