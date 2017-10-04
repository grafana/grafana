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
	if str == "" {
		return
	}

	tagPairs := strings.Split(str, ",")

	for _, tagPair := range tagPairs {
		var tag Tag

		if strings.Contains(tagPair, ":") {
			keyValue := strings.Split(tagPair, ":")
			tag.Key = keyValue[0]
			tag.Value = keyValue[1]
		} else {
			tag.Key = tagPair
		}

		tags = append(tags, &tag)
	}

	return tags
}
