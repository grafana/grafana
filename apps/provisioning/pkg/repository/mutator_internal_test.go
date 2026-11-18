package repository

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestNewAdmissionMutator(t *testing.T) {
	f := &factory{}
	m := NewAdmissionMutator(f, 5*time.Second)
	require.NotNil(t, m)
	require.Same(t, f, m.factory)
}
