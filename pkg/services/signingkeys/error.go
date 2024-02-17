package signingkeys

import "github.com/grafana/grafana/pkg/util/errutil"

var (
	ErrSigningKeyNotFound      = errutil.NotFound("signingkeys.keyNotFound")
	ErrSigningKeyAlreadyExists = errutil.BadRequest("signingkeys.keyAlreadyExists")
	ErrKeyGenerationFailed     = errutil.Internal("signingkeys.keyGenerationFailed")
)
