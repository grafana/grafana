package teamlbac

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestForSubjectErrorClass(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want string
	}{
		{"canceled", fmt.Errorf("read: %w", context.Canceled), "canceled"},
		{"deadline", context.DeadlineExceeded, "timeout"},
		{"unavailable", apierrors.NewServiceUnavailable("unavailable"), "unavailable"},
		{"forbidden", apierrors.NewForbidden(schema.GroupResource{Resource: "teamlbacrules"}, "rule", errors.New("denied")), "authorization"},
		{"other", errors.New("database failed"), "internal"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, string(classifyForSubjectError(tt.err)))
		})
	}
}

func TestForSubjectDatasourceTypeIsBounded(t *testing.T) {
	require.Equal(t, "prometheus", forSubjectDatasourceType("prometheus.datasource-a"))
	require.Equal(t, "other", forSubjectDatasourceType("custom-plugin.datasource-a"))
	require.Equal(t, "other", forSubjectDatasourceType("malformed"))
}
