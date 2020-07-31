package util

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsEmail(t *testing.T) {
	emails := map[string]bool{
		"abc@def.com": true,
		"abcdef.com":  false,
	}
	for input, expected := range emails {
		assert.Equal(t, expected, IsEmail(input))
	}
}
