package router

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store/kind"
	"github.com/grafana/grafana/pkg/services/store/object"
)

type UpstreamResourceSync struct {
	// Config ID
	StorageID string

	// git/s3/gcs/etc
	StorageKiind string

	// The storage key -- absolute includeing the orgID
	KeyPrefix string
}

type ResourceRouteInfo struct {
	// Resource identifier
	GRN *object.GRN

	// The storage key -- absolute includeing the orgID
	Key string

	// The maximum size for the requested resource
	MaxSize int64

	// Upstream storage sync info
	Upstream *UpstreamResourceSync
}

// STORE
//  - kind/{kind}/{uid}
//  - drive/{uid}.{kind}
//  - public/{uid}.{kind} // no authentication

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
		return info, fmt.Errorf("missing ResourceKind")
	}
	if grn.UID == "" {
		return info, fmt.Errorf("missing ResourceIdentifier")
	}

	kind, err := r.kinds.GetInfo(grn.Kind)
	if err != nil {
		return info, fmt.Errorf("unknown kind")
	}

	if grn.Scope == "" {
		return info, fmt.Errorf("missing scope")
	}

	// Human readable file system
	switch grn.Scope {
	case models.ObjectStoreScopeDrive:
		{
			// Special folder handling in drive
			if grn.Kind == models.StandardKindFolder {
				info.Key = fmt.Sprintf("%d/%s/%s/__folder.json", grn.TenantId, grn.Scope, grn.UID)
				return info, nil
			}
			if kind.FileExtension != "" {
				info.Key = fmt.Sprintf("%d/%s/%s.%s", grn.TenantId, grn.Scope, grn.UID, kind.FileExtension)
			} else {
				info.Key = fmt.Sprintf("%d/%s/%s-%s.json", grn.TenantId, grn.Scope, grn.UID, grn.Kind)
			}
		}
	case models.ObjectStoreScopeEntity:
		{
			info.Key = fmt.Sprintf("%d/%s/%s/%s", grn.TenantId, grn.Scope, grn.Kind, grn.UID)
		}
	default:
		return info, fmt.Errorf("unsupportes scope")
	}

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
	p2 := key[:idx]
	key = key[idx+1:]

	tenantID, err := strconv.ParseInt(p0, 10, 64)
	if err != nil {
		return info, fmt.Errorf("error parsing orgID")
	}
	info.GRN.TenantId = tenantID
	info.GRN.Scope = p2

	switch info.GRN.Scope {
	case models.ObjectStoreScopeDrive:
		{
			if strings.HasSuffix(key, ".json") {
				sdx := strings.LastIndex(key, "/")
				idx = strings.LastIndex(key, "-")
				if idx > sdx {
					ddx := strings.LastIndex(key, ".") // .json
					info.GRN.UID = key[:idx]
					info.GRN.Kind = key[idx+1 : ddx]
				} else {
					switch key[sdx+1:] {
					case "__folder.json":
						{
							info.GRN.UID = key[:sdx]
							info.GRN.Kind = models.StandardKindFolder
						}
					default:
						return info, fmt.Errorf("unable to parse drive path")
					}
				}
			} else {
				// Lookup by kind extension ()
				idx = strings.LastIndex(key, ".")
				info.GRN.UID = key[:idx]
				k, err := r.kinds.GetFromExtension(key[idx+1:])
				if err != nil {
					return info, err
				}
				info.GRN.Kind = k.ID
			}
		}

	case models.ObjectStoreScopeEntity:
		{
			idx = strings.Index(key, "/")

			info.GRN.Kind = key[:idx]
			info.GRN.UID = key[idx+1:]
		}

	default:
		return info, fmt.Errorf("unsupported scope")
	}
	return info, nil
}
