package diagnostics

import (
	"fmt"
	"strings"
)

const (
	queryLogMaxLines        = 1000
	queryLogMaxBytes        = 1024 * 1024
	serverWindowLogMaxLines = 2000
	serverWindowLogMaxBytes = 2 * 1024 * 1024
)

// ScopedQueryLog filters an in-memory capture window down to records attributable to this request.
// Records are preserved verbatim: diagnostics redaction remains a project-wide follow-up. Matching
// by datasource UID can include concurrent activity from the same UID, even from another org. The
// bare uid key is required by datasource service logs, but can also admit an unrelated entity whose
// UID happens to equal the diagnosed datasource UID.
func ScopedQueryLog(lines []string, traceID string, dsUIDs []string) []byte {
	needles := datasourceUIDNeedles(dsUIDs)
	if traceID == "" && len(needles) == 0 {
		return nil
	}

	matched := make([]string, 0, min(len(lines), queryLogMaxLines))
	matchedBytes := 0
	matchedCount := 0
	for _, line := range lines {
		if !matchesQueryLogLine(line, traceID, needles) {
			continue
		}

		matchedCount++
		lineBytes := len(line) + 1
		matched = append(matched, line)
		matchedBytes += lineBytes

		for len(matched) > queryLogMaxLines || matchedBytes > queryLogMaxBytes {
			matchedBytes -= len(matched[0]) + 1
			matched = matched[1:]
		}
	}

	var marker string
	if matchedCount > len(matched) {
		for {
			marker = fmt.Sprintf("[diagnostics: query.log truncated; retained last %d of %d matching lines]\n", len(matched), matchedCount)
			if len(marker)+matchedBytes <= queryLogMaxBytes || len(matched) == 0 {
				break
			}
			matchedBytes -= len(matched[0]) + 1
			matched = matched[1:]
		}
	}

	if len(matched) == 0 && marker == "" {
		return nil
	}
	if len(matched) == 0 {
		return []byte(marker)
	}
	return []byte(marker + strings.Join(matched, "\n") + "\n")
}

// ServerWindowLog preserves the newest records emitted during a diagnostics capture window. It is
// bounded independently from the shared capture ring and starts with a marker when truncated.
func ServerWindowLog(lines []string) []byte {
	if len(lines) == 0 {
		return nil
	}

	start := len(lines)
	retainedBytes := 0
	for start > 0 && len(lines)-start < serverWindowLogMaxLines {
		lineBytes := len(lines[start-1]) + 1
		if retainedBytes+lineBytes > serverWindowLogMaxBytes {
			break
		}
		start--
		retainedBytes += lineBytes
	}

	var marker string
	if start > 0 {
		for {
			marker = fmt.Sprintf("[diagnostics: server-window.log truncated; retained last %d of %d lines]\n", len(lines)-start, len(lines))
			if len(marker)+retainedBytes <= serverWindowLogMaxBytes || start == len(lines) {
				break
			}
			retainedBytes -= len(lines[start]) + 1
			start++
		}
	}

	return []byte(marker + strings.Join(lines[start:], "\n") + "\n")
}

func datasourceUIDNeedles(dsUIDs []string) []string {
	datasourceUIDLogKeys := [...]string{"uid", "dsUID", "dsUid", "datasourceUID"}
	seen := make(map[string]struct{}, len(dsUIDs))
	needles := make([]string, 0, len(dsUIDs)*len(datasourceUIDLogKeys))
	for _, uid := range dsUIDs {
		if uid == "" || uid == "__expr__" {
			continue
		}
		if _, ok := seen[uid]; ok {
			continue
		}
		seen[uid] = struct{}{}
		for _, key := range datasourceUIDLogKeys {
			needles = append(needles, key+"="+uid)
		}
	}
	return needles
}

func matchesQueryLogLine(line, traceID string, dsUIDNeedles []string) bool {
	if traceID != "" && containsLogfmtField(line, "traceID="+traceID) {
		return true
	}
	for _, needle := range dsUIDNeedles {
		if containsLogfmtField(line, needle) {
			return true
		}
	}
	return false
}

func containsLogfmtField(line, field string) bool {
	atFieldStart := true
	inQuotedValue := false
	escaped := false
	for idx := 0; idx < len(line); idx++ {
		if inQuotedValue {
			if escaped {
				escaped = false
				continue
			}
			switch line[idx] {
			case '\\':
				escaped = true
			case '"':
				inQuotedValue = false
			}
			continue
		}

		if atFieldStart && strings.HasPrefix(line[idx:], field) {
			end := idx + len(field)
			if end == len(line) || line[end] == ' ' {
				return true
			}
		}

		switch line[idx] {
		case ' ':
			atFieldStart = true
		case '"':
			inQuotedValue = true
		default:
			atFieldStart = false
		}
	}
	return false
}
