package metricutil

import (
	"errors"
	"fmt"
	"strings"
)

// SanitizeLabelName removes all invalid chars from the label name.
// If the label name is empty or contains only invalid chars, it
// will return an error.
func SanitizeLabelName(name string) (string, error) {
	if len(name) == 0 {
		return "", errors.New("label name cannot be empty")
	}

	out := strings.Builder{}
	for i, b := range name {
		if (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || b == '_' || (b >= '0' && b <= '9' && i > 0) {
			out.WriteRune(b)
		} else if b == ' ' {
			out.WriteRune('_')
		}
	}

	if out.Len() == 0 {
		return "", fmt.Errorf("label name only contains invalid chars: %q", name)
	}

	return out.String(), nil
}
