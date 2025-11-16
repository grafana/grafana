package resource

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestContinueToken(t *testing.T) {
	token := &ContinueToken{
		ResourceVersion: 100,
		StartKey:        "apps/resources/default/test-resource",
		EndKey:          "apps/resources/default0",
		SortAscending:   false,
	}
	assert.Equal(t, "eyJrIjoiYXBwcy9yZXNvdXJjZXMvZGVmYXVsdC90ZXN0LXJlc291cmNlIiwiZSI6ImFwcHMvcmVzb3VyY2VzL2RlZmF1bHQwIiwidiI6MTAwLCJzIjpmYWxzZX0=", token.String())
}
