package signingkeys

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrSigningKeyNotFound = errutil.NewBase(errutil.StatusNotFound, "signingkeys.keyNotFound")
)
