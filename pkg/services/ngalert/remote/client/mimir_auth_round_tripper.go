package client

import (
	"net/http"
)

const (
	MimirTenantHeader        = "X-Scope-OrgID"
	RemoteAlertmanagerHeader = "X-Remote-Alertmanager"
)

type MimirAuthRoundTripper struct {
	TenantID string
	Password string
	Next     http.RoundTripper
}

// RoundTrip implements the http.RoundTripper interface
// It adds an `X-Scope-OrgID` header with the TenantID if only provided with a tenantID or sets HTTP Basic Authentication if both
// a tenantID and a password are provided.
func (r *MimirAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	req.Header.Set(RemoteAlertmanagerHeader, "true")
	if r.TenantID != "" && r.Password == "" {
		req.Header.Set(MimirTenantHeader, r.TenantID)
	}

	if r.TenantID != "" && r.Password != "" {
		req.SetBasicAuth(r.TenantID, r.Password)
	}

	return r.Next.RoundTrip(req)
}
