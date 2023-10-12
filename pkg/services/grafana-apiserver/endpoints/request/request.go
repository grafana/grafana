package request

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"k8s.io/apiserver/pkg/endpoints/handlers"
	"k8s.io/apiserver/pkg/endpoints/handlers/negotiation"
	"k8s.io/apiserver/pkg/endpoints/request"
)

type NamespaceInfo struct {
	// OrgID defined in namespace (1 when using stack ids)
	OrgID int64

	// The cloud stack ID (must match the value in cfg.Settings)
	StackID string

	// The original namespace string regardless the input
	Value string
}

func NamespaceInfoFrom(ctx context.Context, requireOrgID bool) (NamespaceInfo, error) {
	info, err := ParseNamespace(request.NamespaceValue(ctx))
	if err == nil && requireOrgID && info.OrgID < 1 {
		return info, fmt.Errorf("expected valid orgId")
	}
	return info, err
}

func ParseNamespace(ns string) (NamespaceInfo, error) {
	info := NamespaceInfo{Value: ns, OrgID: -1}
	if ns == "default" {
		info.OrgID = 1
		return info, nil
	}

	if strings.HasPrefix(ns, "org-") {
		id, err := strconv.Atoi(ns[4:])
		if id < 1 {
			return info, fmt.Errorf("invalid org id")
		}
		if id == 1 {
			return info, fmt.Errorf("use default rather than org-1")
		}
		info.OrgID = int64(id)
		return info, err
	}

	if strings.HasPrefix(ns, "stack-") {
		info.StackID = ns[6:]
		if len(info.StackID) < 2 {
			return info, fmt.Errorf("invalid stack id")
		}
		info.OrgID = 1
		return info, nil
	}
	return info, nil
}

type outputMediaType int

const outputMediaKey outputMediaType = iota

func WithOutputMediaType(ctx context.Context, req *http.Request, scope *handlers.RequestScope) context.Context {
	outputMedia, _, err := negotiation.NegotiateOutputMediaType(req, scope.Serializer, scope)
	if err != nil {
		return ctx
	}
	return context.WithValue(ctx, outputMediaKey, outputMedia)
}

func OutputMediaTypeFrom(ctx context.Context) (negotiation.MediaTypeOptions, bool) {
	mt, ok := ctx.Value(outputMediaKey).(negotiation.MediaTypeOptions)
	return mt, ok
}
