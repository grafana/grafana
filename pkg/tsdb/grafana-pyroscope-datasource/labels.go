package pyroscope

import (
	"net/http"
	"strings"
)

// labelNameNeedsQuoting reports whether a label name contains characters outside
// [a-zA-Z_][a-zA-Z0-9_]* and therefore must be double-quoted in a label selector.
func labelNameNeedsQuoting(name string) bool {
	if len(name) == 0 {
		return true
	}
	for i := 0; i < len(name); i++ {
		b := name[i]
		if i == 0 {
			if !((b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || b == '_') {
				return true
			}
		} else {
			if !((b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') || b == '_') {
				return true
			}
		}
	}
	return false
}

// formatLabelName returns the label name ready for embedding in a label selector,
// wrapping it in double quotes when it contains characters that require quoting.
func formatLabelName(name string) string {
	if labelNameNeedsQuoting(name) {
		escaped := strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(name)
		return `"` + escaped + `"`
	}
	return name
}

// setUTF8AcceptHeader appends "; allow-utf8-labelnames=true" to the Accept header,
// signalling to the Pyroscope API that UTF-8 label names are supported.
// If no Accept header is present, it sets "*/*; allow-utf8-labelnames=true".
func setUTF8AcceptHeader(h http.Header) {
	existing := h.Get("Accept")
	if existing != "" {
		h.Set("Accept", existing+"; allow-utf8-labelnames=true")
	} else {
		h.Set("Accept", "*/*; allow-utf8-labelnames=true")
	}
}
