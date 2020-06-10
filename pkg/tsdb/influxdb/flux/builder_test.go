package flux

import (
	"regexp"
	"testing"
)

var isField = regexp.MustCompile(`^_(time|value|measurement|field|start|stop)$`)

func TestColumnIdentification(t *testing.T) {
	t.Run("Test Field Identification", func(t *testing.T) {
		fieldNames := []string{"_time", "_value", "_measurement", "_field", "_start", "_stop"}
		for _, item := range fieldNames {
			if !isField.MatchString(item) {
				t.Fatal("Field", item, "Expected field, but got false")
			}
		}
	})

	t.Run("Test Not Field Identification", func(t *testing.T) {
		fieldNames := []string{"_header", "_cpu", "_hello", "_doctor"}
		for _, item := range fieldNames {
			if isField.MatchString(item) {
				t.Fatal("Field", item, "Expected NOT a field, but got true")
			}
		}
	})

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
