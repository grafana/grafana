package resource

import (
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestErrResourceAlreadyExistsIsRecognisable(t *testing.T) {
	t.Parallel()

	require.True(t, apierrors.IsAlreadyExists(ErrResourceAlreadyExists), "ErrResourceAlreadyExists should be recognised as an AlreadyExists error")
}
