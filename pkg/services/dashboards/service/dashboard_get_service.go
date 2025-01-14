package service

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/slugify"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/selection"
)

type DashboardGetService struct {
	cfg                 *setting.Cfg
	log                 log.Logger
	dashboardStore      dashboards.Store
	userService         user.Service
	features            featuremgmt.FeatureToggles
	dashboardGetService dashboards.DashboardGetService
	k8sclient           dashboardK8sHandler
}

func ProvideDashboardGetService(
	cfg *setting.Cfg, dashboardStore dashboards.Store,
	features featuremgmt.FeatureToggles,
	r prometheus.Registerer,
	restConfigProvider apiserver.RestConfigProvider, userService user.Service, unified resource.ResourceClient,
) dashboards.DashboardGetService {
	k8sHandler := &dashk8sHandler{
		gvr:                v0alpha1.DashboardResourceInfo.GroupVersionResource(),
		namespacer:         request.GetNamespaceMapper(cfg),
		restConfigProvider: restConfigProvider,
		searcher:           unified,
	}

	dashSvc := &DashboardGetService{
		cfg:            cfg,
		log:            log.New("dashboard-service"),
		dashboardStore: dashboardStore,
		features:       features,
		userService:    userService,
		k8sclient:      k8sHandler,
	}

	return dashSvc
}

func (ds *DashboardGetService) GetDashboard(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	if ds.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		return ds.GetDashboardThroughK8s(ctx, query)
	}

	return ds.dashboardStore.GetDashboard(ctx, query)
}

func (ds *DashboardGetService) GetDashboardUIDByID(ctx context.Context, query *dashboards.GetDashboardRefByIDQuery) (*dashboards.DashboardRef, error) {
	if ds.features.IsEnabledGlobally(featuremgmt.FlagKubernetesCliDashboards) {
		requester, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}
		result, err := ds.SearchDashboardsThroughK8s(ctx, &dashboards.FindPersistedDashboardsQuery{
			OrgId:        requester.GetOrgID(),
			DashboardIds: []int64{query.ID},
		})
		if err != nil {
			return nil, err
		}

		if len(result) != 1 {
			return nil, fmt.Errorf("unexpected number of dashboards found: %d. desired: 1", len(result))
		}

		return &dashboards.DashboardRef{UID: result[0].UID, Slug: result[0].Slug}, nil
	}

	return ds.dashboardStore.GetDashboardUIDByID(ctx, query)
}

func (ds *DashboardGetService) GetDashboardThroughK8s(ctx context.Context, query *dashboards.GetDashboardQuery) (*dashboards.Dashboard, error) {
	// create a new context - prevents issues when the request stems from the k8s api itself
	// otherwise the context goes through the handlers twice and causes issues
	newCtx, cancel, err := getK8sContext(ctx)
	if err != nil {
		return nil, err
	} else if cancel != nil {
		defer cancel()
	}

	client, ok := ds.k8sclient.getClient(newCtx, query.OrgID)
	if !ok {
		return nil, nil
	}

	// if including deleted dashboards for restore, use the /latest subresource
	subresource := ""
	if query.IncludeDeleted && ds.features.IsEnabledGlobally(featuremgmt.FlagKubernetesRestore) {
		subresource = "latest"
	}

	// get uid if not passed in
	if query.UID == "" {
		result, err := ds.GetDashboardUIDByID(ctx, &dashboards.GetDashboardRefByIDQuery{
			ID: query.ID,
		})
		if err != nil {
			return nil, err
		}

		query.UID = result.UID
	}

	out, err := client.Get(newCtx, query.UID, v1.GetOptions{}, subresource)
	if err != nil && !apierrors.IsNotFound(err) {
		return nil, err
	} else if err != nil || out == nil {
		return nil, dashboards.ErrDashboardNotFound
	}

	return ds.UnstructuredToLegacyDashboard(ctx, out, query.OrgID)
}

func (ds *DashboardGetService) SearchDashboardsThroughK8s(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) ([]*dashboards.Dashboard, error) {
	response, err := ds.SearchDashboardsThroughK8sRaw(ctx, query)
	if err != nil {
		return nil, err
	}
	result := make([]*dashboards.Dashboard, len(response.Hits))
	for i, hit := range response.Hits {
		result[i] = &dashboards.Dashboard{
			OrgID:     query.OrgId,
			UID:       hit.Name,
			Slug:      slugify.Slugify(hit.Title),
			Title:     hit.Title,
			FolderUID: hit.Folder,
		}
	}

	return result, nil
}

func (ds *DashboardGetService) SearchDashboardsThroughK8sRaw(ctx context.Context, query *dashboards.FindPersistedDashboardsQuery) (*v0alpha1.SearchResults, error) {
	dashboardskey := &resource.ResourceKey{
		Namespace: ds.k8sclient.getNamespace(query.OrgId),
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}

	request := &resource.ResourceSearchRequest{
		Options: &resource.ListOptions{
			Key:    dashboardskey,
			Fields: []*resource.Requirement{},
			Labels: []*resource.Requirement{},
		},
		Limit: 100000}

	if len(query.DashboardUIDs) > 0 {
		request.Options.Fields = []*resource.Requirement{{
			Key:      "key.name",
			Operator: string(selection.In),
			Values:   query.DashboardUIDs,
		}}
	} else if len(query.DashboardIds) > 0 {
		values := make([]string, len(query.DashboardIds))
		for i, id := range query.DashboardIds {
			values[i] = strconv.FormatInt(id, 10)
		}

		request.Options.Labels = append(request.Options.Labels, &resource.Requirement{
			Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
			Operator: string(selection.In),
			Values:   values,
		})
	}

	if len(query.FolderUIDs) > 0 {
		req := []*resource.Requirement{{
			Key:      "folder",
			Operator: string(selection.In),
			Values:   query.FolderUIDs,
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	if query.ProvisionedRepo != "" {
		req := []*resource.Requirement{{
			Key:      "repo.name",
			Operator: string(selection.In),
			Values:   []string{query.ProvisionedRepo},
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	if len(query.ProvisionedReposNotIn) > 0 {
		req := []*resource.Requirement{{
			Key:      "repo.name",
			Operator: string(selection.NotIn),
			Values:   query.ProvisionedReposNotIn,
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}
	if query.ProvisionedPath != "" {
		req := []*resource.Requirement{{
			Key:      "repo.path",
			Operator: string(selection.In),
			Values:   []string{query.ProvisionedPath},
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	// note: this does not allow for partial matching
	//
	// partial matching will be allowed through the api layer for the frontend,
	// but is currently not needed by other services in the backend
	if query.Title != "" {
		req := []*resource.Requirement{{
			Key:      "title",
			Operator: string(selection.In),
			Values:   []string{query.Title},
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	if len(query.Tags) > 0 {
		req := []*resource.Requirement{{
			Key:      "tags",
			Operator: string(selection.In),
			Values:   query.Tags,
		}}
		request.Options.Fields = append(request.Options.Fields, req...)
	}

	res, err := ds.k8sclient.getSearcher().Search(ctx, request)
	if err != nil {
		return nil, err
	}

	return ParseResults(res, 0)
}

func ParseResults(result *resource.ResourceSearchResponse, offset int64) (*v0alpha1.SearchResults, error) {
	if result == nil {
		return nil, nil
	} else if result.Error != nil {
		return nil, fmt.Errorf("%d error searching: %s: %s", result.Error.Code, result.Error.Message, result.Error.Details)
	} else if result.Results == nil {
		return nil, nil
	}

	titleIDX := 0
	folderIDX := 1
	tagsIDX := -1
	scoreIDX := 0
	explainIDX := 0

	for i, v := range result.Results.Columns {
		switch v.Name {
		case resource.SEARCH_FIELD_EXPLAIN:
			explainIDX = i
		case resource.SEARCH_FIELD_SCORE:
			scoreIDX = i
		case "title":
			titleIDX = i
		case "folder":
			folderIDX = i
		case "tags":
			tagsIDX = i
		}
	}

	sr := &v0alpha1.SearchResults{
		Offset:    offset,
		TotalHits: result.TotalHits,
		QueryCost: result.QueryCost,
		MaxScore:  result.MaxScore,
		Hits:      make([]v0alpha1.DashboardHit, len(result.Results.Rows)),
	}

	for i, row := range result.Results.Rows {
		hit := &v0alpha1.DashboardHit{
			Resource: row.Key.Resource, // folders | dashboards
			Name:     row.Key.Name,     // The Grafana UID
			Title:    string(row.Cells[titleIDX]),
			Folder:   string(row.Cells[folderIDX]),
		}
		if tagsIDX > 0 && row.Cells[tagsIDX] != nil {
			_ = json.Unmarshal(row.Cells[tagsIDX], &hit.Tags)
		}
		if explainIDX > 0 && row.Cells[explainIDX] != nil {
			_ = json.Unmarshal(row.Cells[explainIDX], &hit.Explain)
		}
		if scoreIDX > 0 && row.Cells[scoreIDX] != nil {
			_, _ = binary.Decode(row.Cells[scoreIDX], binary.BigEndian, &hit.Score)
		}

		sr.Hits[i] = *hit
	}

	// Add facet results
	if result.Facet != nil {
		sr.Facets = make(map[string]v0alpha1.FacetResult)
		for k, v := range result.Facet {
			sr.Facets[k] = v0alpha1.FacetResult{
				Field:   v.Field,
				Total:   v.Total,
				Missing: v.Missing,
				Terms:   make([]v0alpha1.TermFacet, len(v.Terms)),
			}
			for j, t := range v.Terms {
				sr.Facets[k].Terms[j] = v0alpha1.TermFacet{
					Term:  t.Term,
					Count: t.Count,
				}
			}
		}
	}

	return sr, nil
}

func (ds *DashboardGetService) UnstructuredToLegacyDashboard(ctx context.Context, item *unstructured.Unstructured, orgID int64) (*dashboards.Dashboard, error) {
	spec, ok := item.Object["spec"].(map[string]any)
	if !ok {
		return nil, errors.New("error parsing dashboard from k8s response")
	}
	obj, err := utils.MetaAccessor(item)
	if err != nil {
		return nil, err
	}
	uid := obj.GetName()
	spec["uid"] = uid

	dashVersion := 0
	if version, ok := spec["version"].(int64); ok {
		dashVersion = int(version)
	}

	out := dashboards.Dashboard{
		OrgID:     orgID,
		ID:        obj.GetDeprecatedInternalID(), // nolint:staticcheck
		UID:       uid,
		Slug:      obj.GetSlug(),
		FolderUID: obj.GetFolder(),
		Version:   dashVersion,
		Data:      simplejson.NewFromAny(spec),
	}

	out.Created = obj.GetCreationTimestamp().Time
	updated, err := obj.GetUpdatedTimestamp()
	if err == nil && updated != nil {
		out.Updated = *updated
	} else {
		// by default, set updated to created
		out.Updated = out.Created
	}

	deleted := obj.GetDeletionTimestamp()
	if deleted != nil {
		out.Deleted = obj.GetDeletionTimestamp().Time
	}

	out.PluginID = GetPluginIDFromMeta(obj)

	creator, err := ds.getUserFromMeta(ctx, obj.GetCreatedBy())
	if err != nil {
		return nil, err
	}
	out.CreatedBy = creator.ID

	updater, err := ds.getUserFromMeta(ctx, obj.GetUpdatedBy())
	if err != nil {
		return nil, err
	}
	out.UpdatedBy = updater.ID

	// any dashboards that have already been synced to unified storage will have the id in the spec
	// and not as a label. We will need to support this conversion until they have all been updated
	// to labels
	if id, ok := spec["id"].(int64); ok {
		out.ID = id
		out.Data.Del("id")
	}

	if gnetID, ok := spec["gnet_id"].(int64); ok {
		out.GnetID = gnetID
	}

	if isFolder, ok := spec["is_folder"].(bool); ok {
		out.IsFolder = isFolder
	}

	if hasACL, ok := spec["has_acl"].(bool); ok {
		out.HasACL = hasACL
	}

	if title, ok := spec["title"].(string); ok {
		out.Title = title
		// if slug isn't in the metadata, add it via the title
		if out.Slug == "" {
			out.UpdateSlug()
		}
	}

	return &out, nil
}

func (ds *DashboardGetService) getUserFromMeta(ctx context.Context, userMeta string) (*user.User, error) {
	if userMeta == "" || toUID(userMeta) == "" {
		return &user.User{}, nil
	}
	usr, err := ds.getUser(ctx, toUID(userMeta))
	if err != nil && errors.Is(err, user.ErrUserNotFound) {
		return &user.User{}, nil
	}
	return usr, err
}

func (ds *DashboardGetService) getUser(ctx context.Context, uid string) (*user.User, error) {
	userId, err := strconv.ParseInt(uid, 10, 64)
	if err == nil {
		return ds.userService.GetByID(ctx, &user.GetUserByIDQuery{ID: userId})
	}
	return ds.userService.GetByUID(ctx, &user.GetUserByUIDQuery{UID: uid})
}
