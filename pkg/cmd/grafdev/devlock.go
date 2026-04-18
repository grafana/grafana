package main

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type devLockKind int

const (
	devLockAbsent devLockKind = iota
	devLockActive
	devLockStale
	devLockUncertain
)

// devLockClassify implements the same .devlock + ps heuristic used by doctor and link status.
func devLockClassify(p RepoPaths) (kind devLockKind, lockPath string) {
	lockPath = p.EnterpriseDevLock()
	if _, err := os.Stat(lockPath); err != nil {
		return devLockAbsent, lockPath
	}
	active, certain := enterpriseDevLockStatus(p.OSS, p.Enterprise)
	switch {
	case active:
		return devLockActive, lockPath
	case certain && !active:
		return devLockStale, lockPath
	default:
		return devLockUncertain, lockPath
	}
}

// devLockDoctorMessage returns printCheck inputs (ok, full sentence).
func devLockDoctorMessage(kind devLockKind, lockPath string) (ok bool, msg string) {
	switch kind {
	case devLockAbsent:
		return true, "no enterprise .devlock (nothing holding the file watcher lock)"
	case devLockActive:
		return true, fmt.Sprintf(".devlock at %s (enterprise-dev watcher process detected — expected while make enterprise-dev is running)", lockPath)
	case devLockStale:
		return false, fmt.Sprintf(".devlock at %s but no matching watcher process — likely stale (grafdev link unlock or make enterprise-unlock)", lockPath)
	default:
		return true, fmt.Sprintf(".devlock at %s (could not confirm watcher via ps; if enterprise-dev is not running, remove stale lock: grafdev link unlock)", lockPath)
	}
}

// devLockLinkSummary returns two lines: status label and indented lock path (path empty for absent).
func devLockLinkSummary(kind devLockKind, lockPath string) (line1, line2 string) {
	switch kind {
	case devLockAbsent:
		return ".devlock:    absent", ""
	case devLockActive:
		return ".devlock:    present — watcher process detected (expected while make enterprise-dev is running)",
			"             " + lockPath
	case devLockStale:
		return ".devlock:    present — likely stale (no matching watcher); try: grafdev link unlock",
			"             " + lockPath
	default:
		return ".devlock:    present — could not confirm via ps; try: grafdev link unlock if nothing is running",
			"             " + lockPath
	}
}

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
