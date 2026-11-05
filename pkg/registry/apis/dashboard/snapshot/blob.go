package snapshot

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func snapshotBlobKey(snap *dashv0.Snapshot) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: snap.Namespace,
		Group:     dashv0.GROUP,
		Resource:  dashv0.SnapshotResourceInfo.GroupResource().Resource,
		Name:      snap.Name,
	}
}

func setDashboardContent(snap *dashv0.Snapshot, dashboard map[string]any) error {
	if dashboard == nil {
		snap.Blobs.Dashboard = nil
		return nil
	}
	value, err := json.Marshal(dashboard)
	if err != nil {
		return err
	}
	snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{
		Data:        new(base64.StdEncoding.EncodeToString(value)),
		ContentType: new("application/json"),
	}
	return nil
}

func decodeDashboardContent(value []byte) (map[string]any, error) {
	var dashboard map[string]any
	decoder := json.NewDecoder(bytes.NewReader(value))
	decoder.UseNumber()
	if !json.Valid(value) {
		return nil, fmt.Errorf("dashboard must be valid JSON")
	}
	if err := decoder.Decode(&dashboard); err != nil {
		return nil, err
	}
	if dashboard == nil {
		return nil, fmt.Errorf("dashboard must be a JSON object")
	}
	return dashboard, nil
}

func inlineDashboardContent(snap *dashv0.Snapshot) (map[string]any, error) {
	ref := snap.Blobs.Dashboard
	if ref == nil {
		return nil, nil
	}
	value, err := json.Marshal(snap.Blobs)
	if err != nil {
		return nil, err
	}
	entries, err := resourcepb.DecodeBlobEntries(value)
	if err != nil {
		return nil, err
	}
	entry := entries["dashboard"]
	if entry.Data == nil {
		return nil, nil
	}
	mediaType, _, err := mime.ParseMediaType(entry.ContentType)
	if err != nil || mediaType != "application/json" {
		return nil, fmt.Errorf("dashboard contentType must be application/json")
	}
	return decodeDashboardContent(entry.Data)
}

func redactDashboardInput(snap *dashv0.Snapshot) {
	if ref := snap.Blobs.Dashboard; ref != nil && ref.Data != nil {
		// An inline input has no authoritative reference until the upload succeeds.
		snap.Blobs.Dashboard = nil
	}
	delete(snap.Annotations, utils.AnnoKeyKubectlLastAppliedConfig)
}

func loadDashboardContent(ctx context.Context, blobs resourcepb.BlobStoreClient, snap *dashv0.Snapshot) (map[string]any, error) {
	ref := snap.Blobs.Dashboard
	if ref == nil {
		return nil, nil
	}
	if ref.Uid == nil || *ref.Uid == "" {
		if ref.Data == nil {
			return nil, nil
		}
		// Historical dashboards were not subject to the new write-input size limit.
		value, err := base64.StdEncoding.DecodeString(*ref.Data)
		if err != nil {
			return nil, err
		}
		return decodeDashboardContent(value)
	}
	if blobs == nil {
		return nil, fmt.Errorf("snapshot %q references a blob but no blob store is configured", snap.Name)
	}
	rsp, err := blobs.GetBlob(ctx, &resourcepb.GetBlobRequest{
		Resource:       snapshotBlobKey(snap),
		Uid:            *ref.Uid,
		MustProxyBytes: true,
	})
	if err := resource.StatusErrorFromResponse(rsp.GetError(), err); err != nil {
		return nil, err
	}
	if rsp == nil {
		return nil, fmt.Errorf("blob store returned no dashboard")
	}
	if rsp.Url != "" {
		return nil, fmt.Errorf("signed blob URLs are not supported yet")
	}
	return decodeDashboardContent(rsp.Value)
}
