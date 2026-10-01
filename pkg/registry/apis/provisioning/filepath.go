package provisioning

import (
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func pathAfterPrefix(urlPath, prefix string) (string, error) {
	_, after, ok := strings.Cut(urlPath, prefix)
	if !ok {
		return "", apierrors.NewBadRequest("invalid request path")
	}

	return strings.TrimPrefix(after, "/"), nil
}
