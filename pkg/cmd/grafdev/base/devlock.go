package base

import (
	"bufio"
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type DevLockKind int

const (
	DevLockAbsent DevLockKind = iota
	DevLockActive
	DevLockStale
	DevLockUncertain
)

// ClassifyDevLock interprets ../grafana-enterprise/.devlock together with running processes.
func ClassifyDevLock(p RepoPaths) (kind DevLockKind, lockPath string) {
	lockPath = p.EnterpriseDevLock()
	if _, err := os.Stat(lockPath); err != nil {
		return DevLockAbsent, lockPath
	}
	active, certain := enterpriseDevLockStatus(p.OSS, p.Enterprise)
	switch {
	case active:
		return DevLockActive, lockPath
	case certain && !active:
		return DevLockStale, lockPath
	default:
		return DevLockUncertain, lockPath
	}
}

// DevLockDoctorMessage returns doctor printCheck inputs (ok, full sentence).
func DevLockDoctorMessage(kind DevLockKind, lockPath string) (ok bool, msg string) {
	switch kind {
	case DevLockAbsent:
		return true, "no enterprise .devlock (nothing holding the file watcher lock)"
	case DevLockActive:
		return true, fmt.Sprintf(".devlock at %s (enterprise-dev watcher process detected — expected while make enterprise-dev is running)", lockPath)
	case DevLockStale:
		return false, fmt.Sprintf(".devlock at %s but no matching watcher process — likely stale (grafdev link unlock or make enterprise-unlock)", lockPath)
	default:
		return true, fmt.Sprintf(".devlock at %s (could not confirm watcher via ps; if enterprise-dev is not running, remove stale lock: grafdev link unlock)", lockPath)
	}
}

// DevLockLinkSummary returns two lines for link status (line2 empty when absent).
func DevLockLinkSummary(kind DevLockKind, lockPath string) (line1, line2 string) {
	switch kind {
	case DevLockAbsent:
		return ".devlock:    absent", ""
	case DevLockActive:
		return ".devlock:    present — watcher process detected (expected while make enterprise-dev is running)",
			"             " + lockPath
	case DevLockStale:
		return ".devlock:    present — likely stale (no matching watcher); try: grafdev link unlock",
			"             " + lockPath
	default:
		return ".devlock:    present — could not confirm via ps; try: grafdev link unlock if nothing is running",
			"             " + lockPath
	}
}

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
		if EnterpriseDevProcessLine(line, ossRoot, entRoot, entStart) {
			return true, true
		}
	}
	return false, true
}

func psForDoctor() ([]byte, error) {
	out, err := exec.Command("ps", "axww", "-o", "args=").Output()
	if err == nil && len(bytes.TrimSpace(out)) > 0 {
		return out, nil
	}
	out, err = exec.Command("ps", "-axwwww", "-o", "args=").Output()
	if err == nil {
		return out, nil
	}
	return out, err
}

// EnterpriseDevProcessLine reports whether a ps args line plausibly belongs to enterprise-dev tooling.
func EnterpriseDevProcessLine(line, ossRoot, entRoot, entStartScript string) bool {
	line = strings.TrimSpace(line)
	if line == "" {
		return false
	}
	if strings.Contains(line, "fswatch") {
		if strings.Contains(line, ossRoot) || strings.Contains(line, entRoot) {
			return true
		}
	}
	if strings.Contains(line, "inotifywait") {
		if strings.Contains(line, ossRoot) || strings.Contains(line, entRoot) {
			return true
		}
	}
	if strings.Contains(line, "start-dev.sh") {
		if strings.Contains(line, entRoot) || strings.Contains(line, entStartScript) {
			return true
		}
	}
	return false
}
