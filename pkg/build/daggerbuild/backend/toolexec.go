package backend

import (
	"os"
	"os/exec"
	"path/filepath"
)

func ResolveToolexecBinary() string {
	envValue := os.Getenv("GO_TRACE_TOOLEXEC_PATH")
	if envValue == "" {
		return ""
	}

	if filepath.IsAbs(envValue) {
		return envValue
	}

	if found, err := exec.LookPath(envValue); err == nil {
		return found
	}

	if absPath, err := filepath.Abs(envValue); err == nil {
		return absPath
	}

	return ""
}
