package signingkeys

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrSigningKeyNotFound      = errutil.NewBase(errutil.StatusNotFound, "signingkeys.keyNotFound")
	ErrSigningKeyAlreadyExists = errutil.NewBase(errutil.StatusBadRequest, "signingkeys.keyAlreadyExists")
	ErrKeyGenerationFailed     = errutil.NewBase(errutil.StatusInternal, "signingkeys.keyGenerationFailed")
)
