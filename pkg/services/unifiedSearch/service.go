package unifiedSearch

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

type StandardSearchService struct {
	registry.BackgroundService
	cfg            *setting.Cfg
	sql            db.DB
	ac             accesscontrol.Service
	orgService     org.Service
	userService    user.Service
	logger         log.Logger
	reIndexCh      chan struct{}
	features       featuremgmt.FeatureToggles
	resourceClient resource.ResourceClient
}

func (s *StandardSearchService) IsReady(ctx context.Context, orgId int64) IsSearchReadyResponse {
	return IsSearchReadyResponse{IsReady: true}
}

func ProvideService(cfg *setting.Cfg, sql db.DB, entityEventStore store.EntityEventsService,
	ac accesscontrol.Service, tracer tracing.Tracer, features featuremgmt.FeatureToggles, orgService org.Service,
	userService user.Service, folderStore folder.Store, resourceClient resource.ResourceClient) SearchService {
	logger := log.New("searchV3")
	s := &StandardSearchService{
		cfg:            cfg,
		sql:            sql,
		ac:             ac,
		logger:         logger,
		reIndexCh:      make(chan struct{}, 1),
		orgService:     orgService,
		userService:    userService,
		features:       features,
		resourceClient: resourceClient,
	}
	return s
}

func (s *StandardSearchService) IsDisabled() bool {
	return !s.features.IsEnabledGlobally(featuremgmt.FlagPanelTitleSearch)
}

func (s *StandardSearchService) Run(ctx context.Context) error {
	// TODO: implement this? ( copied from pkg/services/searchV2/service.go )
	// orgQuery := &org.SearchOrgsQuery{}
	// result, err := s.orgService.Search(ctx, orgQuery)
	// if err != nil {
	// 	return fmt.Errorf("can't get org list: %w", err)
	// }
	// orgIDs := make([]int64, 0, len(result))
	// for _, org := range result {
	// 	orgIDs = append(orgIDs, org.ID)
	// }
	// TODO: do we need to initialize the bleve index again ( should be initialized on startup )?
	// return s.dashboardIndex.run(ctx, orgIDs, s.reIndexCh)
	return nil
}

func (s *StandardSearchService) TriggerReIndex() {
	select {
	case s.reIndexCh <- struct{}{}:
	default:
		// channel is full => re-index will happen soon anyway.
	}
}

func (s *StandardSearchService) getUser(ctx context.Context, backendUser *backend.User, orgId int64) (*user.SignedInUser, error) {
	// TODO: get user & user's permissions from the request context
	var usr *user.SignedInUser
	if s.cfg.AnonymousEnabled && backendUser.Email == "" && backendUser.Login == "" {
		getOrg := org.GetOrgByNameQuery{Name: s.cfg.AnonymousOrgName}
		orga, err := s.orgService.GetByName(ctx, &getOrg)
		if err != nil {
			s.logger.Error("Anonymous access organization error.", "org_name", s.cfg.AnonymousOrgName, "error", err)
			return nil, err
		}

		usr = &user.SignedInUser{
			OrgID:       orga.ID,
			OrgName:     orga.Name,
			OrgRole:     org.RoleType(s.cfg.AnonymousOrgRole),
			IsAnonymous: true,
		}
	} else {
		getSignedInUserQuery := &user.GetSignedInUserQuery{
			Login: backendUser.Login,
			Email: backendUser.Email,
			OrgID: orgId,
		}
		var err error
		usr, err = s.userService.GetSignedInUser(ctx, getSignedInUserQuery)
		if err != nil {
			s.logger.Error("Error while retrieving user", "error", err, "email", backendUser.Email, "login", getSignedInUserQuery.Login)
			return nil, errors.New("auth error")
		}

		if usr == nil {
			s.logger.Error("No user found", "email", backendUser.Email)
			return nil, errors.New("auth error")
		}
	}

	if usr.Permissions == nil {
		usr.Permissions = make(map[int64]map[string][]string)
	}

	if _, ok := usr.Permissions[orgId]; ok {
		// permissions as part of the `s.sql.GetSignedInUser` query - return early
		return usr, nil
	}

	// TODO: ensure this is cached
	permissions, err := s.ac.GetUserPermissions(ctx, usr,
		accesscontrol.Options{ReloadCache: false})
	if err != nil {
		s.logger.Error("Failed to retrieve user permissions", "error", err, "email", backendUser.Email)
		return nil, errors.New("auth error")
	}

	usr.Permissions[orgId] = accesscontrol.GroupScopesByActionContext(ctx, permissions)
	return usr, nil
}

func (s *StandardSearchService) DoQuery(ctx context.Context, user *backend.User, orgID int64, q Query) *backend.DataResponse {
	signedInUser, err := s.getUser(ctx, user, orgID)
	if err != nil {
		return &backend.DataResponse{Error: err}
	}

	return s.doQuery(ctx, signedInUser, orgID, q)
}

func (s *StandardSearchService) doQuery(ctx context.Context, signedInUser *user.SignedInUser, orgID int64, q Query) *backend.DataResponse {
	return s.doSearchQuery(ctx, q, s.cfg.AppSubURL, orgID)
}

func (s *StandardSearchService) doSearchQuery(ctx context.Context, qry Query, _ string, orgID int64) *backend.DataResponse {
	response := &backend.DataResponse{}

	// will use stack id for cloud and org id for on-prem
	tenantId := request.GetNamespaceMapper(s.cfg)(orgID)

	req := newSearchRequest(tenantId, qry)
	res, err := s.resourceClient.Search(ctx, req)
	if err != nil {
		return s.error(err, "Failed to search resources", response)
	}

	frame, err := loadSearchResponse(res, s)
	if err != nil {
		return s.error(err, "Failed to load search response", response)
	}

	response.Frames = append(response.Frames, frame)

	if len(res.Groups) > 0 {
		tagsFrame := loadTagsResponse(res)
		response.Frames = append(response.Frames, tagsFrame)
	}

	return response
}

func (s *StandardSearchService) error(err error, message string, response *backend.DataResponse) *backend.DataResponse {
	s.logger.Error(message, "error", err)
	response.Error = err
	return response
}

func loadSearchResponse(res *resource.SearchResponse, s *StandardSearchService) (*data.Frame, error) {
	frame := newSearchFrame(res)
	for _, r := range res.Items {
		doc, err := getDoc(r.Value)
		if err != nil {
			s.logger.Error("Failed to parse doc", "error", err)
			return nil, err
		}
		kind := strings.ToLower(doc.Kind)
		link := dashboardPageItemLink(doc, s.cfg.AppSubURL)
		frame.AppendRow(kind, doc.UID, doc.Spec.Title, link, doc.Spec.Tags, doc.FolderID)
	}
	return frame, nil
}

func loadTagsResponse(res *resource.SearchResponse) *data.Frame {
	tagsFrame := newTagsFrame()
	for _, grp := range res.Groups {
		tagsFrame.AppendRow(grp.Name, grp.Count)
	}
	return tagsFrame
}

func newSearchFrame(res *resource.SearchResponse) *data.Frame {
	fUID := newField("uid", data.FieldTypeString)
	fKind := newField("kind", data.FieldTypeString)
	fName := newField("name", data.FieldTypeString)
	fLocation := newField("location", data.FieldTypeString)
	fTags := newField("tags", data.FieldTypeNullableJSON)
	fURL := newField("url", data.FieldTypeString)
	fURL.Config = &data.FieldConfig{
		Links: []data.DataLink{
			{Title: "link", URL: "${__value.text}"},
		},
	}

	frame := data.NewFrame("Query results", fKind, fUID, fName, fURL, fTags, fLocation)

	frame.SetMeta(&data.FrameMeta{
		Type: "search-results",
		Custom: &customMeta{
			Count: uint64(len(res.Items)),
		},
	})
	return frame
}

func newTagsFrame() *data.Frame {
	fTag := newField("tag", data.FieldTypeString)
	fCount := newField("count", data.FieldTypeInt64)
	return data.NewFrame("tags", fTag, fCount)
}

func dashboardPageItemLink(doc *DashboardListDoc, subURL string) string {
	if doc.FolderID == "" {
		return fmt.Sprintf("%s/d/%s/%s", subURL, doc.Name, doc.Namespace)
	}
	return fmt.Sprintf("%s/dashboards/f/%s/%s", subURL, doc.Name, doc.Namespace)
}

type customMeta struct {
	Count    uint64  `json:"count"`
	MaxScore float64 `json:"max_score,omitempty"`
	SortBy   string  `json:"sortBy,omitempty"`
}

type DashboardListDoc struct {
	UID       string    `json:"Uid"`
	Group     string    `json:"Group"`
	Namespace string    `json:"Namespace"`
	Kind      string    `json:"Kind"`
	Name      string    `json:"Name"`
	CreatedAt time.Time `json:"CreatedAt"`
	CreatedBy string    `json:"CreatedBy"`
	UpdatedAt time.Time `json:"UpdatedAt"`
	UpdatedBy string    `json:"UpdatedBy"`
	FolderID  string    `json:"FolderId"`
	Spec      struct {
		Title string           `json:"title"`
		Tags  *json.RawMessage `json:"tags"`
	} `json:"Spec"`
}

func getDoc(data []byte) (*DashboardListDoc, error) {
	res := &DashboardListDoc{}
	err := json.Unmarshal(data, res)
	if err != nil {
		return nil, err
	}
	return res, nil
}

func newSearchRequest(tenant string, qry Query) *resource.SearchRequest {
	groupBy := make([]*resource.GroupBy, len(qry.Facet))
	for _, g := range qry.Facet {
		groupBy = append(groupBy, &resource.GroupBy{Name: g.Field, Limit: int64(g.Limit)})
	}

	return &resource.SearchRequest{
		Tenant:  tenant,
		Query:   qry.Query,
		Limit:   int64(qry.Limit),
		Offset:  int64(qry.From),
		Kind:    qry.Kind,
		SortBy:  []string{sortField(qry.Sort)},
		GroupBy: groupBy,
		Filters: qry.Tags,
	}
}

const (
	sortSuffix = "_sort"
	descending = "-"
)

func sortField(sort string) string {
	sf := strings.TrimSuffix(sort, sortSuffix)
	if !strings.HasPrefix(sf, descending) {
		return dashboardListFieldMapping[sf]
	}
	sf = strings.TrimPrefix(sf, descending)
	sf = dashboardListFieldMapping[sf]
	return descending + sf
}

// mapping of dashboard list fields to search doc fields
var dashboardListFieldMapping = map[string]string{
	"name": "title",
}

func newField(name string, typ data.FieldType) *data.Field {
	f := data.NewFieldFromFieldType(typ, 0)
	f.Name = name
	return f
}
