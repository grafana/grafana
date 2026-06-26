package template

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"strings"
)

func FormatVariables(fmt VariableFormat, input []string) string {
	if len(input) < 1 {
		return ""
	}

	// MultiValued formats
	// nolint: exhaustive
	switch fmt {
	case FormatJSON:
		v, _ := json.Marshal(input)
		return string(v)

	case FormatDoubleQuote:
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

	case FormatSingleQuote:
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

	case FormatCSV:
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
	case FormatPipe:
		return strings.Join(input, "|")
	}

	// Raw output (joined with a comma)
	return strings.Join(input, ",")
}
