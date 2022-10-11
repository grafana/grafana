package router

import (
	"context"
	"fmt"
	"strconv"
	"strings"

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
	GRN models.GRN

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
	Route(ctx context.Context, grn models.GRN) (ResourceRouteInfo, error)

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

func (r *standardStoreRouter) Route(ctx context.Context, grn models.GRN) (ResourceRouteInfo, error) {
	info := ResourceRouteInfo{}

	// Make sure the orgID is set
	if grn.OrgID < 1 {
		return info, fmt.Errorf("missing OrgID")
	}
	if grn.Kind == "" {
		return info, fmt.Errorf("missing Kind")
	}
	if grn.UID == "" {
		return info, fmt.Errorf("missing UID")
	}

	kind, err := r.kinds.GetInfo(grn.Kind)
	if err != nil {
		return info, fmt.Errorf("unknown kind")
	}

	if grn.Service != "" && grn.Service != "store" {
		return info, fmt.Errorf("only storage resource?")
	}

	if grn.Namespace == "" {
		grn.Namespace = "store"
	}

	// Human readable file system
	if grn.Namespace == "drive" || grn.Namespace == "public" {
		if kind.FileExtension != "" {
			info.Key = fmt.Sprintf("%d/%s/%s.%s", grn.OrgID, grn.Namespace, grn.UID, kind.FileExtension)
		} else {
			info.Key = fmt.Sprintf("%d/%s/%s-%s.json", grn.OrgID, grn.Namespace, grn.UID, grn.Kind)
		}
	} else {
		// kind as root folder
		info.Key = fmt.Sprintf("%d/%s/kind/%s/%s", grn.OrgID, grn.Namespace, grn.Kind, grn.UID)
	}

	// TODO
	// size + sync support

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

	orgId, err := strconv.ParseInt(p0, 10, 64)
	if err != nil {
		return info, fmt.Errorf("error parsing orgID")
	}
	info.GRN.OrgID = orgId
	info.GRN.Namespace = p2

	// Human file system style
	if p2 == "drive" || p2 == "public" {
		if strings.HasSuffix(key, ".json") {
			idx = strings.LastIndex(key, "-")
			ddx := strings.LastIndex(key, ".") // .json

			info.GRN.UID = key[:idx]
			info.GRN.Kind = key[idx+1 : ddx]
		} else {
			// Lookup by suffix!
			idx = strings.LastIndex(key, ".")
			info.GRN.UID = key[:idx]
			info.GRN.Kind = key[idx+1:]
		}
	} else {
		if !strings.HasPrefix(key, "kind/") {
			return info, fmt.Errorf("expected prefix kind/")
		}
		idx = strings.Index(key, "/") + 1
		key = key[idx:]
		idx = strings.Index(key, "/")

		info.GRN.Kind = key[:idx]
		info.GRN.UID = key[idx+1:]
	}

	return info, nil
}
