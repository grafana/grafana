package logsdrilldown

import (
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func compareResourceNameAndUserUID(name string, u identity.Requester) bool {
	parsedName, err := parseName(name)
	if err != nil {
		return false
	}

	// u.GetUID() returns user:<user_uid> so we need to remove the user: prefix
	userUID := strings.Split(u.GetUID(), ":")
	if len(userUID) != 2 {
		return false
	}

	return parsedName.UID == userUID[1]
}

type storageObjectName struct {
	Service string
	UID     string
}

func parseName(name string) (*storageObjectName, error) {
	vals := strings.Split(name, ":")
	if len(vals) != 2 {
		return nil, errors.New("name must be in the format <service>:<user_uid>")
	}

	return &storageObjectName{
		Service: vals[0],
		UID:     vals[1],
	}, nil
}
