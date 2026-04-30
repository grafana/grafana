package notifier

import (
	"errors"
	"slices"

	"github.com/grafana/alerting/receivers/schema"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

// WithPublicError sets the public message of an errutil error to the error message.
func WithPublicError(err errutil.Error) error {
	err.PublicMessage = err.Error()
	return err
}

// makeProtectedFieldsAuthzError appends fields that caused the error to public payload.
// If provided error is errutil.Error it adds the changed protected fields to the public payload.
func makeProtectedFieldsAuthzError(err error, diff map[string][]schema.IntegrationFieldPath) error {
	var authzErr errutil.Error
	if !errors.As(err, &authzErr) {
		return err
	}
	if authzErr.PublicPayload == nil {
		authzErr.PublicPayload = map[string]interface{}{}
	}
	fields := make(map[string][]string, len(diff))
	for field, paths := range diff {
		fields[field] = make([]string, len(paths))
		for i, path := range paths {
			fields[field][i] = path.String()
		}
		slices.Sort(fields[field])
	}
	authzErr.PublicPayload["changed_protected_fields"] = fields
	return authzErr
}

// MakeProtectedFieldsAuthzError is the exported version for use by other packages.
func MakeProtectedFieldsAuthzError(err error, diff map[string][]schema.IntegrationFieldPath) error {
	return makeProtectedFieldsAuthzError(err, diff)
}
