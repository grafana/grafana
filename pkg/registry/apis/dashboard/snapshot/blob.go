package snapshot

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"google.golang.org/grpc"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/setting"
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

func moveDashboardToBlob(ctx context.Context, blobs resourcepb.BlobStoreClient, snap *dashv0.Snapshot) error {
	if snap.Spec.Dashboard == nil {
		return nil
	}
	value, err := json.Marshal(snap.Spec.Dashboard)
	if err != nil {
		return err
	}
	rsp, err := blobs.PutBlob(ctx, &resourcepb.PutBlobRequest{
		Resource:    snapshotBlobKey(snap),
		Method:      resourcepb.PutBlobRequest_GRPC,
		ContentType: "application/json",
		Value:       value,
	})
	if err != nil {
		return err
	}
	if rsp.Error != nil {
		if rsp.Error.Code == http.StatusNotImplemented {
			return nil
		}
		return resource.StatusError(rsp.Error)
	}

	info := &utils.BlobInfo{MimeType: rsp.MimeType, Charset: rsp.Charset}
	snap.Blobs.Dashboard = &dashv0.SnapshotBlobReference{
		Uid:         rsp.Uid,
		Size:        new(rsp.Size),
		Hash:        new(rsp.Hash),
		ContentType: new(info.ContentType()),
	}
	snap.Spec.Dashboard = nil
	return nil
}

func loadDashboardContent(ctx context.Context, blobs resourcepb.BlobStoreClient, snap *dashv0.Snapshot) (map[string]any, error) {
	ref := snap.Blobs.Dashboard
	if ref == nil || ref.Uid == "" {
		return snap.Spec.Dashboard, nil
	}
	if blobs == nil {
		return nil, fmt.Errorf("snapshot %q references a blob but no blob store is configured", snap.Name)
	}
	rsp, err := blobs.GetBlob(ctx, &resourcepb.GetBlobRequest{
		Resource:       snapshotBlobKey(snap),
		Uid:            ref.Uid,
		MustProxyBytes: true,
	}, grpc.MaxCallRecvMsgSize(setting.DefaultGRPCMaxRecvMsgSize))
	if err != nil {
		return nil, err
	}
	if rsp.Error != nil {
		return nil, resource.StatusError(rsp.Error)
	}
	if rsp.Url != "" {
		return nil, fmt.Errorf("signed blob URLs are not supported yet")
	}
	dash := map[string]any{}
	if err := json.Unmarshal(rsp.Value, &dash); err != nil {
		return nil, err
	}
	return dash, nil
}
