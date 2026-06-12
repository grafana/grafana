package loki

import "strings"

const grafanaSQLHintParser = "PARSER"

// parserHintsFromSchemaContext extracts the PARSER hint from ColumnsRequest.SchemaContext.
func parserHintsFromSchemaContext(schemaContext map[string]string) map[string]string {
	if len(schemaContext) == 0 {
		return nil
	}
	parser := hintGet(schemaContext, grafanaSQLHintParser)
	if parser == "" {
		for k, v := range schemaContext {
			if strings.EqualFold(strings.TrimSpace(k), grafanaSQLHintParser) {
				parser = strings.TrimSpace(v)
				break
			}
		}
	}
	if parser == "" {
		return nil
	}
	return map[string]string{grafanaSQLHintParser: parser}
}

// buildParserStage returns the LogQL parser pipeline fragment from the PARSER hint.
// The value is passed through as LogQL text (e.g. json, json | unpack, pattern "<expr>").
// Returns "" when no parser hint is set.
func buildParserStage(hints map[string]string) (string, error) {
	parser := hintGet(hints, grafanaSQLHintParser)
	if parser == "" {
		return "", nil
	}
	return parser, nil
}
