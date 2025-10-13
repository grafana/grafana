package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestContinueToken(t *testing.T) {
	token := &ContinueToken{
		ResourceVersion: 100,
		StartOffset:     50,
	}
	assert.Equal(t, "eyJvIjo1MCwidiI6MTAwfQ==", token.String())
}
