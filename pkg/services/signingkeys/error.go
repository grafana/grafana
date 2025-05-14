package signingkeys

import "github.com/grafana/grafana/pkg/apimachinery/errutil"

var (
	ErrSigningKeyNotFound      = errutil.NotFound("signingkeys.keyNotFound")
	ErrSigningKeyAlreadyExists = errutil.BadRequest("signingkeys.keyAlreadyExists")
	ErrKeyGenerationFailed     = errutil.Internal("signingkeys.keyGenerationFailed")
)
