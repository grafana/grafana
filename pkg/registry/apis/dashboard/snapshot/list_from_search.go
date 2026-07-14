package snapshot

import (
	"context"
	"fmt"
	"strconv"
	"time"

	claims "github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// defaultSearchListLimit bounds a LIST that does not specify one, mirroring the
// legacy snapshot store default.
const defaultSearchListLimit = int64(1000)

// listFromSearch serves the snapshot LIST from the search index. It returns only
// metadata (never the dashboard body) and reproduces the legacy authorization:
// admins see all snapshots in the org, other users/service accounts see only
// their own, and any other identity sees nothing.
func (n *storageWrapper) listFromSearch(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	gr := dashv0.SnapshotResourceInfo.GroupResource()
	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: requester.GetNamespace(),
				Group:     gr.Group,
				Resource:  gr.Resource,
			},
		},
		Fields: []string{
			resource.SEARCH_FIELD_TITLE,
			builders.SNAPSHOT_EXPIRES,
			builders.SNAPSHOT_EXTERNAL,
			builders.SNAPSHOT_EXTERNAL_URL,
			builders.SNAPSHOT_CREATED,
		},
	}

	// Authorization parity with the legacy SQL store.
	switch {
	case requester.GetOrgRole() == identity.RoleAdmin:
		// Admins see every snapshot in the namespace: no creator filter.
	case requester.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount):
		req.Options.Fields = []*resourcepb.Requirement{{
			Key:      resource.SEARCH_FIELD_CREATED_BY,
			Operator: string(selection.DoubleEquals),
			Values:   []string{requester.GetUID()},
		}}
	default:
		return &dashv0.SnapshotList{}, nil
	}

	limit := defaultSearchListLimit
	if options != nil && options.Limit > 0 {
		limit = options.Limit
	}
	req.Limit = limit

	var offset int64
	if options != nil && options.Continue != "" {
		offset, err = strconv.ParseInt(options.Continue, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid continue token: %w", err)
		}
		req.Offset = offset
	}

	resp, err := n.index.Search(ctx, req)
	if err != nil {
		return nil, err
	}
	if resp.Error != nil {
		return nil, fmt.Errorf("error searching snapshots: %s", resp.Error.Message)
	}

	list := &dashv0.SnapshotList{}
	if resp.ResourceVersion > 0 {
		list.ResourceVersion = strconv.FormatInt(resp.ResourceVersion, 10)
	}
	if resp.Results != nil {
		for _, row := range resp.Results.Rows {
			snap, err := snapshotFromSearchRow(resp.Results.Columns, row)
			if err != nil {
				return nil, err
			}
			list.Items = append(list.Items, *snap)
		}
	}

	// Encode the next offset as the continue token when more results remain.
	if resp.TotalHits > offset+int64(len(list.Items)) {
		list.Continue = strconv.FormatInt(offset+int64(len(list.Items)), 10)
	}

	return list, nil
}

// snapshotFromSearchRow reconstructs a metadata-only Snapshot from a search
// index row. The dashboard body and deleteKey are intentionally never set.
func snapshotFromSearchRow(columns []*resourcepb.ResourceTableColumnDefinition, row *resourcepb.ResourceTableRow) (*dashv0.Snapshot, error) {
	snap := &dashv0.Snapshot{
		ObjectMeta: metav1.ObjectMeta{
			Name:            row.Key.Name,
			Namespace:       row.Key.Namespace,
			ResourceVersion: strconv.FormatInt(row.ResourceVersion, 10),
		},
	}

	for i, col := range columns {
		if i >= len(row.Cells) || row.Cells[i] == nil {
			continue
		}
		cell := row.Cells[i]

		switch col.Name {
		case resource.SEARCH_FIELD_TITLE:
			// Standard string fields are stored as the raw value.
			title := string(cell)
			snap.Spec.Title = &title
		case builders.SNAPSHOT_EXPIRES:
			v, err := resource.DecodeCell(col, i, cell)
			if err != nil {
				return nil, err
			}
			if ms, ok := asInt64(v); ok && ms > 0 {
				snap.Spec.Expires = &ms
			}
		case builders.SNAPSHOT_EXTERNAL:
			v, err := resource.DecodeCell(col, i, cell)
			if err != nil {
				return nil, err
			}
			if b, ok := v.(bool); ok && b {
				snap.Spec.External = &b
			}
		case builders.SNAPSHOT_EXTERNAL_URL:
			v, err := resource.DecodeCell(col, i, cell)
			if err != nil {
				return nil, err
			}
			if s, ok := v.(string); ok && s != "" {
				snap.Spec.ExternalUrl = &s
			}
		case builders.SNAPSHOT_CREATED:
			v, err := resource.DecodeCell(col, i, cell)
			if err != nil {
				return nil, err
			}
			if ms, ok := asInt64(v); ok && ms > 0 {
				snap.CreationTimestamp = metav1.NewTime(time.UnixMilli(ms))
			}
		}
	}

	return snap, nil
}

// asInt64 coerces the numeric shapes DecodeCell can return for int fields.
func asInt64(v any) (int64, bool) {
	switch n := v.(type) {
	case int64:
		return n, true
	case int32:
		return int64(n), true
	case int:
		return int64(n), true
	case float64:
		return int64(n), true
	default:
		return 0, false
	}
}
