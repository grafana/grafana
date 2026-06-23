package annotation

import (
	"errors"
	"strings"
)

type PostGraphiteAnnotationsCmd struct {
	When int64  `json:"when"`
	What string `json:"what"`
	Data string `json:"data"`
	Tags any    `json:"tags"`
}

// Validate checks the required Graphite fields and returns the normalized tags.
func (cmd PostGraphiteAnnotationsCmd) Validate() ([]string, error) {
	if cmd.What == "" {
		return nil, errors.New("what field should not be empty")
	}
	return parseGraphiteTags(cmd.Tags)
}

// FormatGraphiteText joins the Graphite `what` and `data` fields into the annotation text
func FormatGraphiteText(what string, data string) string {
	text := what
	if data != "" {
		text = text + "\n" + data
	}
	return text
}

// parseGraphiteTags normalizes the Graphite `tags` field: a single space-separated
// string (Graphite prior to 0.10.0) or an array of strings; anything else (including a
// missing value) is rejected.
func parseGraphiteTags(raw any) ([]string, error) {
	var tagsArray []string
	switch tags := raw.(type) {
	case string:
		if tags != "" {
			tagsArray = strings.Split(tags, " ")
		} else {
			tagsArray = []string{}
		}
	case []any:
		for _, t := range tags {
			tagStr, ok := t.(string)
			if !ok {
				return nil, errors.New("tag should be a string")
			}
			tagsArray = append(tagsArray, tagStr)
		}
	default:
		return nil, errors.New("unsupported tags format")
	}
	return tagsArray, nil
}
