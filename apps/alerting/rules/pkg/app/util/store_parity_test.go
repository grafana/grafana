package util

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func TestValidateRuleName(t *testing.T) {
	require.NoError(t, ValidateRuleName("rule_UID-1"))
	require.NoError(t, ValidateRuleName(strings.Repeat("a", 40)))
	require.NoError(t, ValidateRuleName(""), "legacy storage generates a UID for an empty name")
	require.Error(t, ValidateRuleName(strings.Repeat("a", 41)))
	require.Error(t, ValidateRuleName("rule.1"))
	require.Error(t, ValidateRuleName("rule 1"))
}

func TestValidateTitle(t *testing.T) {
	require.NoError(t, ValidateTitle("alert rule", "title"))
	require.Error(t, ValidateTitle("alert rule", ""))
	require.Error(t, ValidateTitle("alert rule", strings.Repeat("t", 191)))
}

func TestStoreRejectionIsBadRequest(t *testing.T) {
	// Admission keeps the status of an error that carries one, so this reaches the client as 400, like the store's.
	require.True(t, apierrors.IsBadRequest(ValidateRuleName("rule.1")))
	require.True(t, apierrors.IsBadRequest(ValidateTitle("alert rule", "")))
}
