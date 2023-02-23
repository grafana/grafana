package template

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExpandError(t *testing.T) {
	err := ExpandError{Tmpl: "{{", Err: errors.New("unexpected {{")}
	assert.Equal(t, "failed to expand template '{{': unexpected {{", err.Error())
}
