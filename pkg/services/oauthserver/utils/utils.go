package utils

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/authn"
)

// ParseUserIDFromSubject parses the user ID from format "user:id:<id>".
func ParseUserIDFromSubject(subject string) (int64, error) {
	trimmed := strings.TrimPrefix(subject, fmt.Sprintf("%s:id:", authn.NamespaceUser))
	return strconv.ParseInt(trimmed, 10, 64)
}
