package common

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestIsRetriableDeleteError(t *testing.T) {
	gr := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{"forbidden", apierrors.NewForbidden(gr, "f", errors.New("no")), false},
		{"unauthorized", apierrors.NewUnauthorized("no"), false},
		{"invalid", apierrors.NewInvalid(schema.GroupKind{Group: gr.Group, Kind: "Folder"}, "f", nil), false},
		{"method not supported", apierrors.NewMethodNotSupported(gr, "delete"), false},
		{"conflict", apierrors.NewConflict(gr, "f", errors.New("stale")), true},
		{"bad request", apierrors.NewBadRequest("folder is not empty"), false},
		{"server timeout", apierrors.NewServerTimeout(gr, "delete", 1), true},
		{"internal error", apierrors.NewInternalError(errors.New("boom")), true},
		{"plain error", errors.New("boom"), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, isRetriableDeleteError(tt.err))
		})
	}
}
