// package GRN provides utilities for working with Grafana Resource Names
// (GRNs).

// A GRN is an identifier which encodes all data necessary to retrieve a given
// resource from its respective service.

// A GRN string is expressed in the format:
//   grn:${service}:${tenant_id}:${org_id}:${identifier}
//
// The format of the final identifier is defined by the owning service and not
// validated by the GRN parser. We recommend the format ${kind}/${uid}.

// Individual segments may be omitted from a GRN if the information is not
// relevant for the given resource. A segment is omitted by leaving the value
// blank. For example, resource which aren’t associated with a tenant id would
// omit that segment:
//   grn:${service}::${org_id}:${identifier}

package grn
