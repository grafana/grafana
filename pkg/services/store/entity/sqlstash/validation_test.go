package sqlstash

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestValidateEntity(t *testing.T) {
	t.Parallel()

	err := validateEntity(newEmptyEntity())
	require.NoError(t, err)
}

func TestValidateLabels(t *testing.T) {
	t.Parallel()

	err := validateLabels(map[string]string{})
	require.NoError(t, err)
}

func TestValidateFields(t *testing.T) {
	t.Parallel()

	err := validateFields(map[string]string{})
	require.NoError(t, err)
}

// Silence the `unused` linter until we implement and use these validations.
var (
	_ = validateEntity
	_ = validateLabels
	_ = validateFields
)
