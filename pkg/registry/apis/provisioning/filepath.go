package provisioning

import (
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

func pathAfterPrefix(urlPath, prefix string) (string, error) {
	idx := strings.Index(urlPath, prefix)
	if idx == -1 {
		return "", apierrors.NewBadRequest("invalid request path")
	}

	return strings.TrimPrefix(urlPath[idx+len(prefix):], "/"), nil
}
