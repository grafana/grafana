package resourceutil

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authzlib "github.com/grafana/authlib/authz"
	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestAsErrorResult_NamespaceMismatchIsForbidden(t *testing.T) {
	t.Parallel()

	for name, err := range map[string]error{
		"types":         claims.ErrNamespaceMismatch,
		"wrapped types": fmt.Errorf("wrapped: %w", claims.ErrNamespaceMismatch),
		"authz":         authzlib.ErrNamespaceMismatch,
		"wrapped authz": fmt.Errorf("wrapped: %w", authzlib.ErrNamespaceMismatch),
	} {
		t.Run(name, func(t *testing.T) {
			got := AsErrorResult(err)
			require.Equal(t, &resourcepb.ErrorResult{
				Code:    http.StatusForbidden,
				Reason:  string(metav1.StatusReasonForbidden),
				Message: claims.ErrNamespaceMismatch.Error(),
			}, got)
			require.True(t, apierrors.IsForbidden(StatusError(got)))
		})
	}
}

func TestStatusErrorFromGRPC_NilReturnsNil(t *testing.T) {
	t.Parallel()
	require.NoError(t, StatusErrorFromGRPC(nil))
}
