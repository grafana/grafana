package models

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

// This is mostly a spec... and should likely be defined in the SDK?

// GRN: Grafana Resource Name (as struct)
type GRN struct {
	// Tennant ID -- each login is tied to a single tennant (org)
	OrgID int64 `json:"orgID,omitempty"`

	// The service controller (only 'store' for now)
	Service string `json:"service,omitempty"`

	// Optional namespace (drive? | plugin-X?)
	Namespace string `json:"namespace,omitempty"`

	// Resource kind
	Kind string `json:"kind,omitempty"`

	// UID may have '/'
	UID string `json:"uid,omitempty"`

	// GRN can not be extended
	_ interface{}
}

// AsGRN parse a string and convert it to a GRN struct
// TODO: DUMB implementation... but works enough to start testing
func AsGRN(v string) (GRN, error) {
	grn := GRN{}
	labels, err := data.LabelsFromString(v)
	if err != nil {
		return grn, err
	}
	v, ok := labels["orgID"]
	if ok {
		grn.OrgID, err = strconv.ParseInt(v, 10, 64)
	}
	grn.Kind = labels["kind"]
	grn.Service = labels["service"]
	grn.UID = labels["uid"]
	grn.Kind = labels["kind"]
	return grn, err
}

// String() turns a GRN struct back into into a simple string
func (g *GRN) String() string {
	var sb strings.Builder
	hasData := false
	if g.OrgID > 0 {
		sb.WriteString("orgID")
		sb.WriteString("=")
		sb.WriteString(fmt.Sprintf("%d", g.OrgID))
		hasData = true
	}

	if g.Service != "" {
		if hasData {
			sb.WriteString(",")
		}
		sb.WriteString("service")
		sb.WriteString("=")
		sb.WriteString(g.Service)
		hasData = true
	}

	if g.Namespace != "" {
		if hasData {
			sb.WriteString(",")
		}
		sb.WriteString("namespace")
		sb.WriteString("=")
		sb.WriteString(g.Namespace)
		hasData = true
	}

	if g.Kind != "" {
		if hasData {
			sb.WriteString(",")
		}
		sb.WriteString("kind")
		sb.WriteString("=")
		sb.WriteString(g.Kind)
		hasData = true
	}

	if g.UID != "" {
		if hasData {
			sb.WriteString(",")
		}
		sb.WriteString("uid")
		sb.WriteString("=")
		sb.WriteString(g.UID)
	}
	return sb.String()
}
