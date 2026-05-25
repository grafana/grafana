package folders

import (
	"context"
	"fmt"
	"net/http"
	"strconv"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	childrenDefaultLimit = 500
	childrenMaxLimit     = 500
)

type subChildrenREST struct {
	getter   rest.Getter
	searcher resourcepb.ResourceIndexClient
}

var _ = rest.Connecter(&subChildrenREST{})
var _ = rest.StorageMetadata(&subChildrenREST{})

func (r *subChildrenREST) New() runtime.Object {
	return &folders.FolderList{}
}

func (r *subChildrenREST) Destroy() {
}

func (r *subChildrenREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subChildrenREST) ProducesObject(verb string) interface{} {
	return &folders.FolderList{}
}

func (r *subChildrenREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subChildrenREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subChildrenREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	if name == folder.GeneralFolderUID {
		name = ""
	} else if _, err := r.getter.Get(ctx, name, &v1.GetOptions{}); err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ns, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			responder.Error(err)
			return
		}

		limit, offset, err := parseChildrenPaging(req)
		if err != nil {
			responder.Error(err)
			return
		}

		gvr := folders.FolderResourceInfo.GroupVersionResource()
		resp, err := r.searcher.Search(ctx, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: ns.Value,
					Group:     gvr.Group,
					Resource:  gvr.Resource,
				},
				Fields: []*resourcepb.Requirement{{
					Key:      resource.SEARCH_FIELD_FOLDER,
					Operator: "=",
					Values:   []string{name},
				}},
			},
			Fields: []string{resource.SEARCH_FIELD_TITLE},
			Limit:  limit,
			Offset: offset,
		})
		if err != nil {
			responder.Error(err)
			return
		}
		if resp.Error != nil {
			responder.Error(resource.GetError(resp.Error))
			return
		}

		children := &folders.FolderList{Items: []folders.Folder{}}
		if resp.ResourceVersion > 0 {
			children.ResourceVersion = strconv.FormatInt(resp.ResourceVersion, 10)
		}
		if resp.Results != nil {
			titleIdx := -1
			for i, col := range resp.Results.Columns {
				if col.Name == resource.SEARCH_FIELD_TITLE {
					titleIdx = i
				}
			}
			for _, row := range resp.Results.Rows {
				if row.Key == nil {
					continue
				}
				f := folders.Folder{}
				f.Name = row.Key.Name
				f.Namespace = row.Key.Namespace
				if row.ResourceVersion > 0 {
					f.ResourceVersion = strconv.FormatInt(row.ResourceVersion, 10)
				}
				if titleIdx >= 0 && titleIdx < len(row.Cells) {
					f.Spec.Title = string(row.Cells[titleIdx])
				}
				children.Items = append(children.Items, f)
			}

			total := resp.TotalHits
			if offset+int64(len(resp.Results.Rows)) < total {
				children.Continue = strconv.FormatInt(offset+int64(len(resp.Results.Rows)), 10)
			}
			if total > 0 {
				remaining := total - (offset + int64(len(resp.Results.Rows)))
				if remaining > 0 {
					children.RemainingItemCount = &remaining
				}
			}
		}

		responder.Object(http.StatusOK, children)
	}), nil
}

// The continue token is a raw decimal offset, not an opaque k8s token.
// Offset paging over a live index may skip or duplicate items across pages.
func parseChildrenPaging(req *http.Request) (int64, int64, error) {
	q := req.URL.Query()
	limit := int64(childrenDefaultLimit)
	if v := q.Get("limit"); v != "" {
		parsed, err := strconv.ParseInt(v, 10, 64)
		if err != nil || parsed < 0 {
			return 0, 0, fmt.Errorf("invalid limit: %q", v)
		}
		if parsed > 0 {
			limit = parsed
		}
	}
	if limit > childrenMaxLimit {
		limit = childrenMaxLimit
	}

	var offset int64
	if v := q.Get("continue"); v != "" {
		parsed, err := strconv.ParseInt(v, 10, 64)
		if err != nil || parsed < 0 {
			return 0, 0, fmt.Errorf("invalid continue token: %q", v)
		}
		offset = parsed
	}
	return limit, offset, nil
}
