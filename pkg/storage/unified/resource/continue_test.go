package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestContinueToken(t *testing.T) {
	token := &ContinueToken{
		ResourceVersion: 100,
		StartOffset:     50,
		SortAscending:   false,
	}
	assert.Equal(t, "eyJvIjo1MCwidiI6MTAwLCJzIjpmYWxzZX0=", token.String())
}
