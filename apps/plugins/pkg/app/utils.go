package app

import (
	"fmt"
	"strings"
)

func ToMetadataName(id, version string) (string, error) {
	if id == "" {
		return "", fmt.Errorf("id is required")
	}
	if version == "" {
		return "", fmt.Errorf("version is required")
	}
	return fmt.Sprintf("%s_%s", id, version), nil
}

func FromMetadataName(name string) (id, version string, ok bool) {
	parts := strings.Split(name, "_")
	if len(parts) != 2 {
		return "", "", false
	}
	return parts[0], parts[1], true
}
