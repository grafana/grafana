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
			require.Equal(t, int32(http.StatusForbidden), got.Code)
			require.Equal(t, string(metav1.StatusReasonForbidden), got.Reason)
			require.Equal(t, claims.ErrNamespaceMismatch.Error(), got.Message)
			require.True(t, apierrors.IsForbidden(StatusError(got)))
		})
	}
}

func TestStatusErrorFromGRPC_NilReturnsNil(t *testing.T) {
	t.Parallel()
	require.NoError(t, StatusErrorFromGRPC(nil))
}
