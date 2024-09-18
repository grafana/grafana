package notifier

import "github.com/grafana/grafana/pkg/util/errutil"

// WithPublicError sets the public message of an errutil error to the error message.
func WithPublicError(err errutil.Error) error {
	err.PublicMessage = err.Error()
	return err
}
