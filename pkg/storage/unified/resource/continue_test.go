package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestContinueToken(t *testing.T) {
	token := &ContinueToken{
		ResourceVersion: 100,
		StartKey:        "apps/resources/default/test-resource",
		SortAscending:   false,
	}
	assert.Equal(t, "eyJ2IjoxMDAsImsiOiJhcHBzL3Jlc291cmNlcy9kZWZhdWx0L3Rlc3QtcmVzb3VyY2UiLCJzIjpmYWxzZX0=", token.String())
}
