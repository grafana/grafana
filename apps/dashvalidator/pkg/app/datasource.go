package app

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"regexp"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// ErrDatasourceNotFound is returned (possibly wrapped) by DatasourceProvider.Get
// when the datasource does not exist in the namespace.
var ErrDatasourceNotFound = errors.New("datasource not found")

// Datasource is the subset of a Grafana datasource the validator needs.
type Datasource struct {
	UID  string
	Type string
	URL  string
	// Transport is resolved lazily so the handler can reject unsupported
	// datasource types before any authentication setup happens.
	Transport func(ctx context.Context) (http.RoundTripper, error)
}

// DatasourceProvider supplies datasource access to the app. It is implemented
// by the host so this module does not depend on Grafana's service packages.
type DatasourceProvider interface {
	// CanQuery reports whether the user may read and query the datasource with the given UID.
	CanQuery(ctx context.Context, user identity.Requester, uid string) (bool, error)
	// Get resolves a datasource by namespace, UID and type.
	Get(ctx context.Context, namespace, uid, dsType string) (*Datasource, error)
}

// Mirrors Grafana's short UID rules (pkg/util.ValidateUID) without importing the root module.
const maxUIDLength = 40

var validUIDPattern = regexp.MustCompile(`^[a-zA-Z0-9\-\_]*$`).MatchString

var (
	errUIDTooLong       = fmt.Errorf("UID is longer than %d symbols", maxUIDLength)
	errUIDFormatInvalid = errors.New("invalid format of UID. Only letters, numbers, '-' and '_' are allowed")
	errUIDEmpty         = errors.New("UID is empty")
)

func validateUID(uid string) error {
	if len(uid) == 0 {
		return errUIDEmpty
	}
	if len(uid) > maxUIDLength {
		return errUIDTooLong
	}
	if !validUIDPattern(uid) {
		return errUIDFormatInvalid
	}
	return nil
}
