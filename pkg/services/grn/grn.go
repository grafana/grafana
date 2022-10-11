package grn

import (
	"fmt"
	"strings"
)

type GRN struct {
	// Service identifies the service responsible for the resource.
	Service Service

	// TenantID is specific to hosted grafana and will be omitted in other
	// environments.
	TenantID string

	// OrgID contains the ID of the organization the resource belongs to. This
	// field may be omitted for global Grafana resources which are not
	// associated with an organization.
	OrgID string

	// ResourceIdentifier is used by the underlying service to identify the
	// resource.
	ResourceIdentifier string
}

// FIXME: This maybe premature optimization on my part, since Grafana doesn't
// already have a strict notion of namespaces/service delination.
type Service string

func ParseGRNStr(str string) (GRN, error) {
	parts := strings.Split(str, ":")
	ret := GRN{}

	if len(parts) != 5 {
		return ret, ErrInvalidGRN.Errorf("%q is not a complete GRN", str)
	}

	if parts[0] != "grn" {
		return ret, ErrInvalidGRN.Errorf("%q does not look like a GRN", str)
	}

	// todo: validation
	return GRN{
		TenantID:           parts[1],
		OrgID:              parts[2],
		Service:            Service(parts[3]),
		ResourceIdentifier: parts[4],
	}, nil
}

func MustParseGRNStr(str string) GRN {
	grn, err := ParseGRNStr(str)
	if err != nil {
		panic("bad grn!")
	}
	return grn
}

func (g *GRN) String() string {
	return fmt.Sprintf("grn:%s:%s:%s:%s", g.Service, g.TenantID, g.OrgID, g.ResourceIdentifier)
}
