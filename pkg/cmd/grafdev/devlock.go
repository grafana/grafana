package main

import (
	"bufio"
	"bytes"
	"os/exec"
	"path/filepath"
	"strings"
)

// enterpriseDevLockStatus interprets ../grafana-enterprise/.devlock together with running processes.
// certain is false if we could not run ps or got no output (caller should not treat as stale proof).
// active is true when a process line plausibly belongs to start-dev.sh / fswatch / inotifywait for this OSS+GE pair.
func enterpriseDevLockStatus(ossRoot, entRoot string) (active, certain bool) {
	ossRoot = filepath.Clean(ossRoot)
	entRoot = filepath.Clean(entRoot)
	entStart := filepath.Join(entRoot, "start-dev.sh")

	out, err := psForDoctor()
	if err != nil || len(bytes.TrimSpace(out)) == 0 {
		return false, false
	}
	certain = true

	sc := bufio.NewScanner(bytes.NewReader(out))
	for sc.Scan() {
		line := sc.Text()
		if enterpriseDevProcessLine(line, ossRoot, entRoot, entStart) {
			return true, true
		}
	}
	return false, true
}

func psForDoctor() ([]byte, error) {
	// macOS / BSD: full-width args column
	out, err := exec.Command("ps", "axww", "-o", "args=").Output()
	if err == nil && len(bytes.TrimSpace(out)) > 0 {
		return out, nil
	}
	// Linux procps-ng (repeat -w for wider command column)
	out, err = exec.Command("ps", "-axwwww", "-o", "args=").Output()
	if err == nil {
		return out, nil
	}
	return out, err
}

func enterpriseDevProcessLine(line, ossRoot, entRoot, entStartScript string) bool {
	line = strings.TrimSpace(line)
	if line == "" {
		return false
	}
	// macOS enterprise-dev uses fswatch with absolute watch paths under OSS.
	if strings.Contains(line, "fswatch") {
		if strings.Contains(line, ossRoot) || strings.Contains(line, entRoot) {
			return true
		}
	}
	// Linux path
	if strings.Contains(line, "inotifywait") {
		if strings.Contains(line, ossRoot) || strings.Contains(line, entRoot) {
			return true
		}
	}
	// start-dev.sh is launched from the enterprise checkout (often absolute path in argv).
	if strings.Contains(line, "start-dev.sh") {
		if strings.Contains(line, entRoot) || strings.Contains(line, entStartScript) {
			return true
		}
	}
	return false
}
