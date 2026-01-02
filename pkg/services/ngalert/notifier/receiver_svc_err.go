package notifier

import (
	"errors"
	"slices"

	"github.com/grafana/alerting/receivers/schema"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

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
