package grn

import (
	"fmt"
	"strings"
)

type GRN struct {
	// TenantID contains the ID of the tenant (in hosted grafana) or
	// organization (in other environments) the resource belongs to. This field
	// may be omitted for global Grafana resources which are not associated with
	// an organization.
	TenantID string

	// The kind of resource being identified, for e.g. "dashboard" or "user".
	// The caller is responsible for validating the value.
	ResourceKind string

	// ResourceIdentifier is used by the underlying service to identify the
	// resource.
	ResourceIdentifier string
}

// ParseStr attempts to parse a string into a GRN. It returns an error if the
// given string does not match the GRN format, but does not validate the values.
func ParseStr(str string) (GRN, error) {
	ret := GRN{}
	parts := strings.Split(str, ":")

	if len(parts) != 3 {
		return ret, ErrInvalidGRN.Errorf("%q is not a complete GRN", str)
	}

	if parts[0] != "grn" {
		return ret, ErrInvalidGRN.Errorf("%q does not look like a GRN", str)
	}

	// split the final segment into Kind and ID. This only splits after the
	// first occurrence of "/"; a ResourceIdentifier may contain "/"
	kind, id, found := strings.Cut(parts[2], "/")
	if !found { // missing "/"
		return ret, ErrInvalidGRN.Errorf("invalid resource identifier in GRN %q", str)
	}

	// todo: validation
	return GRN{
		TenantID:           parts[1],
		ResourceKind:       kind,
		ResourceIdentifier: id,
	}, nil
}

// MustParseStr is a wrapper around ParseStr that panics if the given input is
// not a valid GRN. This is intended for use in tests.
func MustParseStr(str string) GRN {
	grn, err := ParseStr(str)
	if err != nil {
		panic("bad grn!")
	}
	return grn
}

// String returns a string representation of a grn in the format
// grn:tenantID:kind/resourceIdentifier
func (g *GRN) String() string {
	return fmt.Sprintf("grn:%s:%s/%s", g.TenantID, g.ResourceKind, g.ResourceIdentifier)
}
