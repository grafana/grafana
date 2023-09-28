package grn

import (
	"fmt"
	"strconv"
	"strings"
)

// ParseStr attempts to parse a string into a GRN. It returns an error if the
// given string does not match the GRN format, but does not validate the values.
func ParseStr(str string) (*GRN, error) {
	ret := &GRN{}
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
	ret.ResourceIdentifier = id
	ret.ResourceKind = kind

	if parts[1] != "" {
		tID, err := strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return ret, ErrInvalidGRN.Errorf("ID segment cannot be converted to an integer")
		} else {
			ret.TenantID = tID
		}
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
	return fmt.Sprintf("grn:%d:%s/%s", g.TenantID, g.ResourceKind, g.ResourceIdentifier)
}

// Check if the two GRNs reference to the same object
// we can not use simple `*x == *b` because of the internal settings
func (g *GRN) Equal(b *GRN) bool {
	if b == nil {
		return false
	}
	return g == b || (g.TenantID == b.TenantID &&
		g.ResourceKind == b.ResourceKind &&
		g.ResourceIdentifier == b.ResourceIdentifier)
}
