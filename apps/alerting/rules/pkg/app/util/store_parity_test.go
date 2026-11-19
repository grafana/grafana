package util

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestValidateTitle(t *testing.T) {
	require.NoError(t, ValidateTitle("alert rule", "title"))
	require.Error(t, ValidateTitle("alert rule", ""))
	require.Error(t, ValidateTitle("alert rule", strings.Repeat("t", 191)))
}

func TestStoreRejectionIsBadRequest(t *testing.T) {
	// Admission keeps the status of an error that carries one, so this reaches the client as 400, like the store's.
	require.True(t, apierrors.IsBadRequest(ValidateTitle("alert rule", "")))
}
