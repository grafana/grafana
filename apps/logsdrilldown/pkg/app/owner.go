package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/k8s"
)

// validateOwner admits a write to a LogsDrilldown only for the user its name
// belongs to. Names are <service>:<user_uid>, one object per user and service.
// It runs as admission so the rule holds wherever the app is served: the
// router, which never calls the API server's authorizer, as well as the
// embedded API server.
func validateOwner(ctx context.Context, req *app.AdmissionRequest) error {
	info, ok := types.AuthInfoFrom(ctx)
	if !ok {
		return forbidden("valid user is required")
	}
	// Service identities are held to their token's permissions before admission.
	if types.IsIdentityType(info.GetIdentityType(), types.TypeAccessPolicy) {
		return nil
	}
	// Grafana Admins may edit anyone's settings, as the embedded API server's
	// authorizer allows. Only that server's requester carries the flag.
	if admin, ok := info.(interface{ GetIsGrafanaAdmin() bool }); ok && admin.GetIsGrafanaAdmin() {
		return nil
	}

	obj := req.Object
	if obj == nil {
		obj = req.OldObject // a delete carries only the stored object
	}
	if obj == nil {
		return forbidden("request has no object")
	}

	_, userUID, err := types.ParseTypeID(info.GetUID())
	if err != nil || userUID == "" {
		return forbidden("caller has no user UID")
	}
	owner, ok := ownerFromName(obj.GetName())
	if !ok {
		return forbidden(fmt.Sprintf("name %q must be in the format <service>:<user_uid>", obj.GetName()))
	}
	if owner != userUID {
		return forbidden("you are not the owner of the resource")
	}
	return nil
}

// ownerFromName returns the user UID a LogsDrilldown name belongs to.
func ownerFromName(name string) (string, bool) {
	service, owner, found := strings.Cut(name, ":")
	if !found || service == "" || owner == "" || strings.Contains(owner, ":") {
		return "", false
	}
	return owner, true
}

func forbidden(msg string) error {
	return k8s.NewAdmissionError(errors.New(msg), http.StatusForbidden, "Forbidden")
}
