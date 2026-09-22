package searchencoding

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAnnotationsJSON(t *testing.T) {
	assert.Equal(t, "", AnnotationsJSON(map[string]string(nil)))
	assert.Equal(t, "", AnnotationsJSON(map[string]string{}))
	assert.JSONEq(t, `{"summary":"cpu is high"}`, AnnotationsJSON(map[string]string{"summary": "cpu is high"}))
}
