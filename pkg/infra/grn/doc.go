// package GRN provides utilities for working with Grafana Resource Names
// (GRNs).

// A GRN is an identifier which encodes all data necessary to retrieve a given
// resource from its respective service.

// A GRN string is expressed in the format:
//   grn:${tenant_id}:${org_id}:${kind}/${id}
//
// The format of the final id is defined by the owning service and not
// validated by the GRN parser. Prefer using UIDs where possible.

// Individual segments may be omitted from a GRN if the information is not
// relevant for the given resource. A segment is omitted by leaving the value
// blank. For example, resources which aren’t associated with a tenantID would
// omit that segment:
//   grn::${org_id}:${kind}/${id}

package grn
