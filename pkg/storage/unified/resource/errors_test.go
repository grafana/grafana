package resource

import (
	"fmt"
	"net/http"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestErrResourceAlreadyExistsIsRecognisable(t *testing.T) {
	t.Parallel()

	require.True(t, apierrors.IsAlreadyExists(ErrResourceAlreadyExists), "ErrResourceAlreadyExists should be recognised as an AlreadyExists error")
}

func TestAsErrorResult_NamespaceMismatchIsForbidden(t *testing.T) {
	t.Parallel()

	// The guard fires inside the list transaction, so the sentinel reaches
	// AsErrorResult behind the transaction wrapper rather than on its own.
	transactional := fmt.Errorf("transactional operation: %w", claims.ErrNamespaceMismatch)

	for name, err := range map[string]error{
		"bare":    claims.ErrNamespaceMismatch,
		"wrapped": transactional,
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			got := AsErrorResult(err)
			require.Equal(t, int32(http.StatusForbidden), got.Code, "an authorization outcome must not burn the 5xx error budget")
			require.Equal(t, string(metav1.StatusReasonForbidden), got.Reason)
			require.Equal(t, claims.ErrNamespaceMismatch.Error(), got.Message)
			require.True(t, apierrors.IsForbidden(GetError(got)), "callers should see a typed Forbidden error")
		})
	}
}
