package app

import (
	"context"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	logsdrilldownv1alpha1 "github.com/grafana/grafana/apps/logsdrilldown/pkg/apis/logsdrilldown/v1alpha1"
)

// caller is the identity the router hands the app: an access token on behalf
// of a user, with no Grafana Admin flag.
type caller struct {
	types.AuthInfo
	uid string
	typ types.IdentityType
}

func (c caller) GetUID() string                      { return c.uid }
func (c caller) GetIdentityType() types.IdentityType { return c.typ }

// adminCaller is the embedded API server's requester, which carries the flag.
type adminCaller struct {
	caller
	admin bool
}

func (c adminCaller) GetIsGrafanaAdmin() bool { return c.admin }

func object(name string) resource.Object {
	return &logsdrilldownv1alpha1.LogsDrilldown{ObjectMeta: metav1.ObjectMeta{Name: name}}
}

func TestValidateOwner(t *testing.T) {
	alice := caller{uid: "user:alice", typ: types.TypeUser}

	tests := []struct {
		name    string
		who     types.AuthInfo
		req     *app.AdmissionRequest
		allowed bool
	}{
		{
			name:    "owner creates",
			who:     alice,
			req:     &app.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: object("logs:alice")},
			allowed: true,
		},
		{
			name: "owner updates",
			who:  alice,
			req: &app.AdmissionRequest{Action: resource.AdmissionActionUpdate,
				Object: object("logs:alice"), OldObject: object("logs:alice")},
			allowed: true,
		},
		{
			name:    "owner deletes, with only the stored object",
			who:     alice,
			req:     &app.AdmissionRequest{Action: resource.AdmissionActionDelete, OldObject: object("logs:alice")},
			allowed: true,
		},
		{
			name: "another user creates under the owner's name",
			who:  alice,
			req:  &app.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: object("logs:bob")},
		},
		{
			name: "another user deletes",
			who:  alice,
			req:  &app.AdmissionRequest{Action: resource.AdmissionActionDelete, OldObject: object("logs:bob")},
		},
		{
			name: "name without a service",
			who:  alice,
			req:  &app.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: object("alice")},
		},
		{
			name: "name with extra segments",
			who:  alice,
			req:  &app.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: object("logs:alice:x")},
		},
		{
			name: "user-prefixed name is not the owner format",
			who:  alice,
			req:  &app.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: object("user-alice")},
		},
		{
			name:    "Grafana Admin edits another user's settings",
			who:     adminCaller{caller: alice, admin: true},
			req:     &app.AdmissionRequest{Action: resource.AdmissionActionUpdate, Object: object("logs:bob")},
			allowed: true,
		},
		{
			name: "requester that is not a Grafana Admin",
			who:  adminCaller{caller: alice},
			req:  &app.AdmissionRequest{Action: resource.AdmissionActionUpdate, Object: object("logs:bob")},
		},
		{
			name:    "service identity",
			who:     caller{uid: "access-policy:provisioning", typ: types.TypeAccessPolicy},
			req:     &app.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: object("logs:bob")},
			allowed: true,
		},
		{
			name: "no caller",
			req:  &app.AdmissionRequest{Action: resource.AdmissionActionCreate, Object: object("logs:alice")},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			if tc.who != nil {
				ctx = types.WithAuthInfo(ctx, tc.who)
			}
			err := validateOwner(ctx, tc.req)
			if tc.allowed && err != nil {
				t.Fatalf("expected the request to be admitted, got %v", err)
			}
			if !tc.allowed && err == nil {
				t.Fatal("expected the request to be denied")
			}
		})
	}
}
