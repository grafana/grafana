package peakq

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"strings"

	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
)

func formatVariables(fmt peakq.VariableFormat, input []string) string {
	if len(input) < 1 {
		return ""
	}

	// MultiValued formats
	// nolint: exhaustive
	switch fmt {
	case peakq.FormatJSON:
		v, _ := json.Marshal(input)
		return string(v)

	case peakq.FormatDoubleQuote:
		sb := bytes.NewBufferString("")
		for idx, val := range input {
			if idx > 0 {
				_, _ = sb.WriteRune(',')
			}
			_, _ = sb.WriteRune('"')
			_, _ = sb.WriteString(strings.ReplaceAll(val, `"`, `\"`))
			_, _ = sb.WriteRune('"')
		}
		return sb.String()

	case peakq.FormatSingleQuote:
		sb := bytes.NewBufferString("")
		for idx, val := range input {
			if idx > 0 {
				_, _ = sb.WriteRune(',')
			}
			_, _ = sb.WriteRune('\'')
			_, _ = sb.WriteString(strings.ReplaceAll(val, `'`, `\'`))
			_, _ = sb.WriteRune('\'')
		}
		return sb.String()

	case peakq.FormatCSV:
		sb := bytes.NewBufferString("")
		w := csv.NewWriter(sb)
		_ = w.Write(input)
		w.Flush()
		v := sb.Bytes()
		return string(v[:len(v)-1])
	}

	// Single valued formats
	if len(input) == 1 {
		return input[0]
	}

	// nolint: exhaustive
	switch fmt {
	case peakq.FormatPipe:
		return strings.Join(input, "|")
	}

	// Raw output (joined with a comma)
	return strings.Join(input, ",")
}
