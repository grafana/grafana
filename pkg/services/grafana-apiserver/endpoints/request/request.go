package request

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"k8s.io/apiserver/pkg/endpoints/request"
)

type NamespaceInfo struct {
	OrgID   int64
	StackID string
}

func OrgIDFrom(ctx context.Context) (NamespaceInfo, error) {
	return ParseNamespace(request.NamespaceValue(ctx))
}

func ParseNamespace(ns string) (NamespaceInfo, error) {
	if ns == "default" {
		return NamespaceInfo{
			OrgID: 1,
		}, nil
	}

	if strings.HasPrefix(ns, "org-") {
		id, err := strconv.Atoi(ns[4:])
		if id == 1 {
			return NamespaceInfo{}, fmt.Errorf("use default rather than org-1")
		}
		return NamespaceInfo{
			OrgID: int64(id),
		}, err
	}

	if strings.HasPrefix(ns, "stack-") {
		id := ns[6:]
		if len(id) < 4 {
			return NamespaceInfo{}, fmt.Errorf("invalid stack id")
		}
		return NamespaceInfo{
			OrgID:   1,
			StackID: id,
		}, nil
	}

	return NamespaceInfo{}, fmt.Errorf("unable to parse org/stack from namespace")
}
