package azuremonitor

import (
	"fmt"
	"regexp"
)

type resource struct {
	ID             string
	Name           string
	Type           string
	Location       string
	SubscriptionID string
}

func (r *resource) GetKey() string {
	return fmt.Sprintf("%s-%s-%s-%s", r.SubscriptionID, r.ParseGroup(), r.Type, r.Location)
}

func (r *resource) ParseGroup() string {
	regexp, err := regexp.Compile(".*/resourceGroups/(.*?)/")
	if err != nil {
		return ""
	}

	matches := regexp.FindStringSubmatch(r.ID)
	if len(matches) > 0 {
		return matches[1]
	}

	return ""
}
