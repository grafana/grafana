package flux

import (
	"testing"
)

func TestColumnIdentification(t *testing.T) {
	t.Run("Test Tag Identification", func(t *testing.T) {
		tagNames := []string{"header", "value", "tag"}
		for _, item := range tagNames {
			if !isTag(item) {
				t.Fatal("Tag", item, "Expected tag, but got false")
			}
		}
	})

	t.Run("Test Special Case Tag Identification", func(t *testing.T) {
		notTagNames := []string{"table", "result"}
		for _, item := range notTagNames {
			if isTag(item) {
				t.Fatal("Special tag", item, "Expected NOT a tag, but got true")
			}
		}
	})
}
