// Package foldertitle resolves folder UIDs to display titles from storage.
// Separate from embed because importing resource.StorageBackend there would cycle (resource -> embedder -> embed).
package foldertitle

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	folderGroup    = "folder.grafana.app"
	folderResource = "folders"
)

// Resolver resolves folder UIDs to display titles; embed-time results go stale on rename until re-embed.
type Resolver struct {
	storage resource.StorageBackend
}

func NewResolver(storage resource.StorageBackend) *Resolver {
	return &Resolver{storage: storage}
}

// Title resolves folderUID's display title; "" folderUID and deleted folders return ("", nil), other storage errors propagate.
func (r *Resolver) Title(ctx context.Context, namespace, folderUID string) (string, error) {
	if folderUID == "" {
		return "", nil
	}

	resp := r.storage.ReadResource(ctx, &resourcepb.ReadRequest{
		Key: &resourcepb.ResourceKey{
			Namespace: namespace,
			Group:     folderGroup,
			Resource:  folderResource,
			Name:      folderUID,
		},
	})
	if resp.Error != nil {
		if resp.Error.Code == http.StatusNotFound {
			return "", nil
		}
		return "", resource.GetError(resp.Error)
	}

	var folder struct {
		Spec struct {
			Title string `json:"title"`
		} `json:"spec"`
	}
	if err := json.Unmarshal(resp.Value, &folder); err != nil {
		return "", err
	}
	return folder.Spec.Title, nil
}
