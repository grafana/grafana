package router

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/grafana/grafana/pkg/services/store/object"
)

type ResourceRouteInfo struct {
	// The resource identifier
	GRN *object.GRN

	// Raw key used in storage engine
	Key string
}

type ObjectStoreRouter interface {
	// This will throw exceptions for unsupported
	Route(ctx context.Context, grn *object.GRN) (ResourceRouteInfo, error)

	// Parse a key to get the GRN and storage information
	RouteFromKey(ctx context.Context, key string) (ResourceRouteInfo, error)
}

type standardStoreRouter struct {
	kinds kind.KindRegistry
}

func NewObjectStoreRouter(kinds kind.KindRegistry) ObjectStoreRouter {
	return &standardStoreRouter{kinds: kinds}
}

var _ ObjectStoreRouter = &standardStoreRouter{}

func (r *standardStoreRouter) Route(ctx context.Context, grn *object.GRN) (ResourceRouteInfo, error) {
	info := ResourceRouteInfo{
		GRN: grn,
	}

	if grn == nil {
		return info, fmt.Errorf("missing GRN")
	}

	// Make sure the orgID is set
	if grn.TenantId < 1 {
		return info, fmt.Errorf("missing TenantId")
	}
	if grn.Kind == "" {
		return info, fmt.Errorf("missing Kind")
	}
	if grn.UID == "" {
		return info, fmt.Errorf("missing UID")
	}

	_, err := r.kinds.GetInfo(grn.Kind)
	if err != nil {
		return info, fmt.Errorf("unknown Kind: " + grn.Kind)
	}

	info.Key = fmt.Sprintf("%d/%s/%s", grn.TenantId, grn.Kind, grn.UID)

	return info, nil
}

func (r *standardStoreRouter) RouteFromKey(ctx context.Context, key string) (ResourceRouteInfo, error) {
	info := ResourceRouteInfo{
		Key: key,
		GRN: &object.GRN{},
	}
	// {orgID}/{scope}/....

	idx := strings.Index(key, "/")
	if idx <= 0 {
		return info, fmt.Errorf("can not find orgID")
	}
	p0 := key[:idx]
	key = key[idx+1:]
	idx = strings.Index(key, "/")
	if idx <= 0 {
		return info, fmt.Errorf("can not find namespace")
	}

	tenantID, err := strconv.ParseInt(p0, 10, 64)
	if err != nil {
		return info, fmt.Errorf("error parsing orgID")
	}
	info.GRN.TenantId = tenantID

	info.GRN.Kind = key[:idx]
	info.GRN.UID = key[idx+1:]

	return info, nil
}
