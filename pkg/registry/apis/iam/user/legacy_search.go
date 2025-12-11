package user

import (
	"context"
	"encoding/binary"
	"fmt"
	"log/slog"
	"math"
	"regexp"
	"sort"

	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/searchusers/sortopts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

const (
	UserResource      = "users"
	UserResourceGroup = "iam.grafana.com"
)

var (
	_               resourcepb.ResourceIndexClient = (*UserLegacySearchClient)(nil)
	fieldLogin                                     = fmt.Sprintf("%s%s", resource.SEARCH_FIELD_PREFIX, builders.USER_LOGIN)
	fieldEmail                                     = fmt.Sprintf("%s%s", resource.SEARCH_FIELD_PREFIX, builders.USER_EMAIL)
	fieldLastSeenAt                                = fmt.Sprintf("%s%s", resource.SEARCH_FIELD_PREFIX, builders.USER_LAST_SEEN_AT)
	fieldRole                                      = fmt.Sprintf("%s%s", resource.SEARCH_FIELD_PREFIX, builders.USER_ROLE)
)

// UserLegacySearchClient is a client for searching for users in the legacy search engine.
type UserLegacySearchClient struct {
	resourcepb.ResourceIndexClient
	orgService org.Service
	log        *slog.Logger
	tracer     trace.Tracer
	cfg        *setting.Cfg
}

// NewUserLegacySearchClient creates a new UserLegacySearchClient.
func NewUserLegacySearchClient(orgService org.Service, tracer trace.Tracer, cfg *setting.Cfg) *UserLegacySearchClient {
	return &UserLegacySearchClient{
		orgService: orgService,
		log:        slog.Default().With("logger", "legacy-user-search-client"),
		tracer:     tracer,
		cfg:        cfg,
	}
}

// Search searches for users in the legacy search engine.
// It only supports exact matching for title, login, or email.
func (c *UserLegacySearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := c.tracer.Start(ctx, "user.Search")
	defer span.End()

	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	if req.Limit > maxLimit {
		req.Limit = maxLimit
	}
	if req.Limit <= 0 {
		req.Limit = 30
	}

	if req.Page > math.MaxInt32 || req.Page < 0 {
		return nil, fmt.Errorf("invalid page number: %d", req.Page)
	}

	if req.Page < 1 {
		req.Page = 1
	}

	wildcardsMatcher := regexp.MustCompile(`[\*\?\\]`)

	legacySortOptions := convertToSortOptions(req.SortBy)

	// Unified search `query` has wildcards, but legacy search does not support them.
	// We have to remove them here to make legacy search work as expected with SQL LIKE queries.
	if req.Query != "" {
		req.Query = wildcardsMatcher.ReplaceAllString(req.Query, "")
	}

	query := &org.SearchOrgUsersQuery{
		OrgID:    signedInUser.GetOrgID(),
		Query:    req.Query,
		Limit:    int(req.Limit),
		Page:     int(req.Page),
		SortOpts: legacySortOptions,

		User: signedInUser,
	}

	var title, login, email string
	for _, field := range req.Options.Fields {
		vals := field.GetValues()
		if len(vals) != 1 {
			c.log.Warn("only single value fields are supported for legacy search, using first value", "field", field.Key, "values", vals)
		}
		switch field.Key {
		case resource.SEARCH_FIELD_TITLE:
			title = vals[0]
		case fieldLogin:
			login = vals[0]
		case fieldEmail:
			email = vals[0]
		}
	}

	// The user store's Search method combines these into an OR.
	// For legacy search we can only supply one.
	if title != "" {
		query.Query = title
	} else if login != "" {
		query.Query = login
	} else {
		query.Query = email
	}

	if req.Query != "" {
		query.Query = req.Query
	}

	fields := req.Fields
	if len(fields) == 0 {
		fields = []string{resource.SEARCH_FIELD_TITLE, fieldEmail, fieldLogin, fieldLastSeenAt, fieldRole}
	}

	columns := getColumns(fields)
	list := &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: columns,
		},
	}

	res, err := c.orgService.SearchOrgUsers(ctx, query)
	if err != nil {
		return nil, err
	}

	for _, u := range res.OrgUsers {
		if c.isHiddenUser(u.Login, signedInUser) {
			continue
		}

		cells := createCells(u, req.Fields)
		list.Results.Rows = append(list.Results.Rows, &resourcepb.ResourceTableRow{
			Key:   getResourceKey(u, req.Options.Key.Namespace),
			Cells: cells,
		})
	}

	list.TotalHits = res.TotalCount
	return list, nil
}

func (c *UserLegacySearchClient) isHiddenUser(login string, signedInUser identity.Requester) bool {
	if login == "" || signedInUser.GetIsGrafanaAdmin() || login == signedInUser.GetUsername() {
		return false
	}

	if _, hidden := c.cfg.HiddenUsers[login]; hidden {
		return true
	}

	return false
}

func getResourceKey(item *org.OrgUserDTO, namespace string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: namespace,
		Group:     UserResourceGroup,
		Resource:  UserResource,
		Name:      item.UID,
	}
}

func getColumns(fields []string) []*resourcepb.ResourceTableColumnDefinition {
	cols := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(fields))
	standardSearchFields := resource.StandardSearchFields()
	for _, field := range fields {
		switch field {
		case resource.SEARCH_FIELD_TITLE:
			cols = append(cols, standardSearchFields.Field(resource.SEARCH_FIELD_TITLE))
		case fieldLastSeenAt:
			cols = append(cols, builders.UserTableColumnDefinitions[builders.USER_LAST_SEEN_AT])
		case fieldRole:
			cols = append(cols, builders.UserTableColumnDefinitions[builders.USER_ROLE])
		case fieldEmail:
			cols = append(cols, builders.UserTableColumnDefinitions[builders.USER_EMAIL])
		case fieldLogin:
			cols = append(cols, builders.UserTableColumnDefinitions[builders.USER_LOGIN])
		}
	}
	return cols
}

func createCells(u *org.OrgUserDTO, fields []string) [][]byte {
	cells := make([][]byte, 0, len(fields))
	for _, field := range fields {
		switch field {
		case resource.SEARCH_FIELD_TITLE:
			cells = append(cells, []byte(u.Name))
		case fieldEmail:
			cells = append(cells, []byte(u.Email))
		case fieldLogin:
			cells = append(cells, []byte(u.Login))
		case fieldLastSeenAt:
			b := make([]byte, 8)
			binary.BigEndian.PutUint64(b, uint64(u.LastSeenAt.Unix()))
			cells = append(cells, b)
		case fieldRole:
			cells = append(cells, []byte(u.Role))
		}
	}
	return cells
}

func convertToSortOptions(sortBy []*resourcepb.ResourceSearchRequest_Sort) []model.SortOption {
	opts := []model.SortOption{}
	for _, s := range sortBy {
		field := s.Field
		// Handle mapping if necessary
		switch field {
		case fieldLastSeenAt:
			field = "lastSeenAtAge"
		case resource.SEARCH_FIELD_TITLE:
			field = "name"
		case fieldLogin:
			field = "login"
		case fieldEmail:
			field = "email"
		}

		suffix := "asc"
		if s.Desc {
			suffix = "desc"
		}
		key := fmt.Sprintf("%s-%s", field, suffix)

		if opt, ok := sortopts.SortOptionsByQueryParam[key]; ok {
			opts = append(opts, opt)
		}
	}
	sort.Slice(opts, func(i, j int) bool {
		return opts[i].Index < opts[j].Index || (opts[i].Index == opts[j].Index && opts[i].Name < opts[j].Name)
	})
	return opts
}
