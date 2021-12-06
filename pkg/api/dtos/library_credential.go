package dtos

import (
	"github.com/grafana/grafana/pkg/components/simplejson"
)

type LibraryCredentialDto struct {
	Id               int64            `json:"id"`
	UID              string           `json:"uid"`
	OrgId            int64            `json:"orgId"`
	Name             string           `json:"name"`
	Type             string           `json:"type"`
	JsonData         *simplejson.Json `json:"jsonData,omitempty"`
	SecureJsonFields map[string]bool  `json:"secureJsonFields"`
	ReadOnly         bool             `json:"readOnly"`
}
