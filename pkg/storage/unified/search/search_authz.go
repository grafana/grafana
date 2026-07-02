package search

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func compileSearchChecker(ctx context.Context, access authlib.AccessClient, req *resourcepb.ResourceSearchRequest) (authlib.ItemChecker, error) {
	if access == nil || req.Options == nil || req.Options.Key == nil {
		return nil, nil
	}
	user, ok := authlib.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return nil, nil
	}
	verb := utils.VerbGet
	if req.Permission == int64(dashboardaccess.PERMISSION_EDIT) {
		verb = utils.VerbUpdate
	}
	checker, _, err := access.Compile(ctx, user, authlib.ListRequest{
		Namespace: req.Options.Key.Namespace,
		Group:     req.Options.Key.Group,
		Resource:  req.Options.Key.Resource,
		Verb:      verb,
	})
	return checker, err
}

// CompileSearchCheckerForTest exposes authz compilation for tests.
func CompileSearchCheckerForTest(ctx context.Context, access authlib.AccessClient, req *resourcepb.ResourceSearchRequest) (authlib.ItemChecker, error) {
	return compileSearchChecker(ctx, access, req)
}

func needsPostFilter(checker authlib.ItemChecker, authz *resourcepb.AuthzFilter) bool {
	if checker == nil {
		return false
	}
	if authz == nil {
		return true
	}
	if authz.All {
		return false
	}
	return len(authz.Folders) == 0 && len(authz.Names) == 0
}

func overFetchLimit(limit int64) int64 {
	if limit <= 0 {
		return limit
	}
	if limit < 200 {
		return limit * 4
	}
	return limit
}

func filterSearchResponse(rsp *resourcepb.SearchResponse, checker authlib.ItemChecker, limit int64) *resourcepb.SearchResponse {
	if rsp == nil || checker == nil {
		return rsp
	}
	filtered := make([]*resourcepb.Hit, 0, len(rsp.Hits))
	for _, hit := range rsp.Hits {
		if hit == nil || hit.Key == nil {
			continue
		}
		if checker(hit.Key.Name, hitFolder(hit)) {
			filtered = append(filtered, hit)
		}
	}
	if limit > 0 && int64(len(filtered)) > limit {
		filtered = filtered[:limit]
	}
	rsp.Hits = filtered
	rsp.TotalHits = int64(len(filtered))
	return rsp
}

func hitFolder(hit *resourcepb.Hit) string {
	for _, fv := range hit.Fields {
		if fv == nil {
			continue
		}
		if fv.Name == resource.SEARCH_FIELD_FOLDER || fv.Name == "folder" {
			return fieldValueString(fv)
		}
	}
	return ""
}

func fieldValueString(fv *resourcepb.FieldValue) string {
	if fv == nil || len(fv.Values) == 0 {
		return ""
	}
	return fv.Values[0].GetStringValue()
}
