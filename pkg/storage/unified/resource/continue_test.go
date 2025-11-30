package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestContinueToken(t *testing.T) {
	token := &ContinueToken{
		ResourceVersion: 100,
		StartKeyOffset:  "apps/resources/default/test-resource",
		SortAscending:   false,
	}
	assert.Equal(t, "eyJrIjoiYXBwcy9yZXNvdXJjZXMvZGVmYXVsdC90ZXN0LXJlc291cmNlIiwidiI6MTAwLCJzIjpmYWxzZX0=", token.String())
}
