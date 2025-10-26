package provisioning

import (
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/registry/rest"
)

// respondWithError checks if the provided error contains an API error and unwraps it before passing it to the responder.
func respondWithError(responder rest.Responder, err error) {
	var statusErr *apierrors.StatusError
	if errors.As(err, &statusErr) {
		responder.Error(statusErr)
	} else {
		responder.Error(err)
	}
}
