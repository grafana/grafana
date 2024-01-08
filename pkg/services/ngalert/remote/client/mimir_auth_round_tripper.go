package client

import (
	"net/http"

	"github.com/grafana/grafana/pkg/services/ngalert/client"
)

const mimirTenantHeader = "X-Scope-OrgID"

type MimirAuthRoundTripper struct {
	TenantID    string
	Password    string
	TimedClient *client.TimedClient
}

// RoundTrip implements the http.RoundTripper interface
// It adds an `X-Scope-OrgID` header with the TenantID if only provided with a tenantID or sets HTTP Basic Authentication if both
// a tenantID and a password are provided.
func (r *MimirAuthRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if r.TenantID != "" && r.Password == "" {
		req.Header.Set(mimirTenantHeader, r.TenantID)
	}

	if r.TenantID != "" && r.Password != "" {
		req.SetBasicAuth(r.TenantID, r.Password)
	}

	return r.TimedClient.Do(req)
}
