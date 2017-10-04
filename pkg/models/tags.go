package models

import (
	"strings"
)

type Tag struct {
	Id    int64
	Key   string
	Value string
}

func ParseTagsString(str string) (tags []*Tag) {
	if strings.Trim(str, " ") == "" {
		return
	}

	tagPairs := strings.Split(strings.Trim(str, " "), ",")

	for _, tagPair := range tagPairs {
		var tag Tag

		if strings.Contains(tagPair, ":") {
			keyValue := strings.Split(tagPair, ":")
			tag.Key = strings.Trim(keyValue[0], " ")
			tag.Value = strings.Trim(keyValue[1], " ")
		} else {
			tag.Key = strings.Trim(tagPair, " ")
		}

		if tag.Key == "" {
			continue
		}

		tags = append(tags, &tag)
	}

	return tags
}
