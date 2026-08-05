// Package foldertitle resolves a folder UID to its current display title by
// reading the folder resource straight from storage.
//
// This lives outside the parent embed package deliberately:
// pkg/storage/unified/resource defines resource.StorageBackend and depends
// on embed transitively (resource -> embedder -> embed), so embed importing
// resource.StorageBackend directly would create an import cycle. This
// subpackage isn't part of that chain and can import resource freely.
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

// Resolver resolves a folder UID to its current display title. Titles are
// resolved at embed time and go stale on rename until the next re-embed;
// query-time consumers should prefer resolving fresh rather than trusting
// stored copies.
type Resolver struct {
	storage resource.StorageBackend
}

// NewResolver builds a resolver backed by storage.
func NewResolver(storage resource.StorageBackend) *Resolver {
	return &Resolver{storage: storage}
}

// Title returns the display title for folderUID within namespace. An empty
// folderUID (root-level resource) and a folder that no longer exists both
// return ("", nil) — neither is an error condition worth failing the caller
// over. Any other storage error is returned so the caller can decide whether
// to retry.
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
