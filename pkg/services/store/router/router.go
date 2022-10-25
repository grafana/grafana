package router

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/grn"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/store/kind"
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
	GRN grn.GRN

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
	Route(ctx context.Context, grn grn.GRN) (ResourceRouteInfo, error)

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

func (r *standardStoreRouter) Route(ctx context.Context, grn grn.GRN) (ResourceRouteInfo, error) {
	info := ResourceRouteInfo{}

	// Make sure the orgID is set
	if grn.TenantID < 1 {
		return info, fmt.Errorf("missing TenantID")
	}
	if grn.ResourceKind == "" {
		return info, fmt.Errorf("missing ResourceKind")
	}
	if grn.ResourceIdentifier == "" {
		return info, fmt.Errorf("missing ResourceIdentifier")
	}

	kind, err := r.kinds.GetInfo(grn.ResourceKind)
	if err != nil {
		return info, fmt.Errorf("unknown kind")
	}

	if grn.Service != "" && grn.Service != "store" {
		return info, fmt.Errorf("only storage resource?")
	}

	if grn.Namespace == "" {
		grn.Namespace = "drive" // defatul to the file path model for HTTP!
	}

	// Human readable file system
	if grn.Namespace == "drive" || grn.Namespace == "public" {
		// Special folder for
		if grn.ResourceKind == models.StandardKindFolder {
			info.Key = fmt.Sprintf("%d/%s/%s/__folder.json", grn.TenantID, grn.Namespace, grn.ResourceIdentifier)
		} else if grn.ResourceKind == models.StandardKindFolderAccess {
			info.Key = fmt.Sprintf("%d/%s/%s/__access.json", grn.TenantID, grn.Namespace, grn.ResourceIdentifier)
		} else {
			if kind.FileExtension != "" {
				info.Key = fmt.Sprintf("%d/%s/%s.%s", grn.TenantID, grn.Namespace, grn.ResourceIdentifier, kind.FileExtension)
			} else {
				info.Key = fmt.Sprintf("%d/%s/%s-%s.json", grn.TenantID, grn.Namespace, grn.ResourceIdentifier, grn.ResourceKind)
			}
		}
	} else {
		// kind as root folder
		info.Key = fmt.Sprintf("%d/%s/kind/%s/%s", grn.TenantID, grn.Namespace, grn.ResourceKind, grn.ResourceIdentifier)
	}

	info.GRN = grn
	return info, nil
}

func (r *standardStoreRouter) RouteFromKey(ctx context.Context, key string) (ResourceRouteInfo, error) {
	info := ResourceRouteInfo{
		Key: key,
	}
	// {orgID}/{namespace}/....

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
	info.GRN.TenantID = tenantID
	info.GRN.Namespace = p2

	// Human file system style
	if p2 == "drive" || p2 == "public" {
		if strings.HasSuffix(key, ".json") {
			sdx := strings.LastIndex(key, "/")
			idx = strings.LastIndex(key, "-")
			if idx > sdx {
				ddx := strings.LastIndex(key, ".") // .json
				info.GRN.ResourceIdentifier = key[:idx]
				info.GRN.ResourceKind = key[idx+1 : ddx]
			} else {
				switch key[sdx+1:] {
				case "__folder.json":
					{
						info.GRN.ResourceIdentifier = key[:sdx]
						info.GRN.ResourceKind = models.StandardKindFolder
					}
				case "__access.json":
					{
						info.GRN.ResourceIdentifier = key[:sdx]
						info.GRN.ResourceKind = models.StandardKindFolderAccess
					}
				default:
					return info, fmt.Errorf("unable to parse drive path")
				}
			}
		} else {
			// Lookup by kind extension ()
			idx = strings.LastIndex(key, ".")
			info.GRN.ResourceIdentifier = key[:idx]
			k, err := r.kinds.GetFromExtension(key[idx+1:])
			if err != nil {
				return info, err
			}
			info.GRN.ResourceKind = k.ID
		}
	} else {
		if !strings.HasPrefix(key, "kind/") {
			return info, fmt.Errorf("expected prefix kind/")
		}
		idx = strings.Index(key, "/") + 1
		key = key[idx:]
		idx = strings.Index(key, "/")

		info.GRN.ResourceKind = key[:idx]
		info.GRN.ResourceIdentifier = key[idx+1:]
	}

	return info, nil
}
