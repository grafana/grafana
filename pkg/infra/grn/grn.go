package grn

import (
	"fmt"
	"strconv"
	"strings"
)

// ParseStr attempts to parse a string into a GRN. It returns an error if the
// given string does not match the GRN format, but does not validate the values.
// grn:<TenantID>:<ResourceGroup>/<ResourceKind>/<ResourceIdentifier>
// No component of the GRN may contain a colon
// The TenantID is optional, but must be an integer string if specified
// The ResourceGroup, ResourceKind and ResourceIdentifier must be non-empty strings
// The ResourceGroup and ResourceKind may not contain slashes
// The ResourceIdentifier may contain slashes
func ParseStr(str string) (*GRN, error) {
	ret := &GRN{}

	parts := strings.Split(str, ":")
	if len(parts) != 3 {
		return ret, ErrInvalidGRN.Errorf("%q is not a complete GRN", str)
	}

	if parts[0] != "grn" {
		return ret, ErrInvalidGRN.Errorf("%q does not look like a GRN", str)
	}

	if parts[1] != "" {
		tID, err := strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return ret, ErrInvalidGRN.Errorf("Tenant ID segment cannot be converted to an integer")
		}

		ret.TenantID = tID
	}

	// split the rest of the GRN into Group, Kind and Identifier
	parts = strings.SplitN(parts[2], "/", 3)
	if len(parts) != 3 {
		return ret, ErrInvalidGRN.Errorf("%q is not a complete GRN", str)
	}

	ret.ResourceGroup = parts[0]
	ret.ResourceKind = parts[1]
	ret.ResourceIdentifier = parts[2]

	if ret.ResourceGroup == "" {
		return ret, ErrInvalidGRN.Errorf("Cannot find resource group in GRN %q", str)
	}
	if ret.ResourceKind == "" {
		return ret, ErrInvalidGRN.Errorf("Cannot find resource kind in GRN %q", str)
	}
	if ret.ResourceIdentifier == "" {
		return ret, ErrInvalidGRN.Errorf("Cannot find resource identifier in GRN %q", str)
	}

	return ret, nil
}

// MustParseStr is a wrapper around ParseStr that panics if the given input is
// not a valid GRN. This is intended for use in tests.
func MustParseStr(str string) *GRN {
	grn, err := ParseStr(str)
	if err != nil {
		panic("bad grn!")
	}
	return grn
}

// ToGRNString returns a string representation of a grn in the format
// grn:tenantID:kind/resourceIdentifier
func (g *GRN) ToGRNString() string {
	return fmt.Sprintf("grn:%d:%s/%s/%s", g.TenantID, g.ResourceGroup, g.ResourceKind, g.ResourceIdentifier)
}

// Check if the two GRNs reference to the same object
// we can not use simple `*x == *b` because of the internal settings
func (g *GRN) Equal(b *GRN) bool {
	if b == nil {
		return false
	}
	return g == b || (g.TenantID == b.TenantID &&
		g.ResourceGroup == b.ResourceGroup &&
		g.ResourceKind == b.ResourceKind &&
		g.ResourceIdentifier == b.ResourceIdentifier)
}
