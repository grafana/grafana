package app

import (
	"context"
	"errors"
	"strings"

	authtypes "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/userstorage/pkg/apis/userstorage/v0alpha1"
)

// New builds the user storage app.
func New(cfg app.Config) (app.App, error) {
	a, err := simple.NewApp(simple.AppConfig{
		Name:       "userstorage",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{{
			Kind:      v0alpha1.UserStorageKind(),
			Validator: &simple.Validator{ValidateFunc: validateUserStorage},
		}},
	})
	if err != nil {
		return nil, err
	}
	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}
	return a, nil
}

// validateUserStorage requires a new object to be named for the user creating
// it. Access to an existing object is decided by the same name, in the router.
func validateUserStorage(ctx context.Context, req *app.AdmissionRequest) error {
	if req.Action != resource.AdmissionActionCreate {
		return nil
	}
	if req.Object == nil {
		return errors.New("missing object")
	}
	name := req.Object.GetName()
	if !NameMatchesUser(name, callerUID(ctx, req)) {
		// The same error the embedded API server's strategy reports.
		return apierrors.NewInvalid(v0alpha1.UserStorageKind().GroupVersionKind().GroupKind(), name, field.ErrorList{
			field.Forbidden(field.NewPath("metadata", "name"), "name must match service:user_uid"),
		})
	}
	return nil
}

// callerUID is the identity UID of the user making the request. Admission
// reviews from the router carry no user info: the caller is the identity of
// the access token the app was called with.
func callerUID(ctx context.Context, req *app.AdmissionRequest) string {
	if info, ok := authtypes.AuthInfoFrom(ctx); ok {
		return info.GetUID()
	}
	return req.UserInfo.UID
}

// NameMatchesUser reports whether name is <service>:<uid> for the user whose
// identity UID is userUID, which is written <type>:<uid>.
func NameMatchesUser(name, userUID string) bool {
	_, nameUID, ok := ParseName(name)
	if !ok {
		return false
	}
	_, uid, ok := strings.Cut(userUID, ":")
	return ok && !strings.Contains(uid, ":") && uid == nameUID
}

// ParseName splits an object name into the service and the user uid.
func ParseName(name string) (service, uid string, ok bool) {
	vals := strings.Split(name, ":")
	if len(vals) != 2 {
		return "", "", false
	}
	return vals[0], vals[1], true
}
