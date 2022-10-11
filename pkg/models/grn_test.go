package models

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSimpleGRN(t *testing.T) {
	grn := GRN{}
	grn.Service = "store"

	copy, err := AsGRN(grn.String())
	require.NoError(t, err)
	require.Equal(t, grn.Service, copy.Service)
}
