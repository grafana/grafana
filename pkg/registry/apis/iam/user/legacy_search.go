package user

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"regexp"

	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacysort"
	"github.com/grafana/grafana/pkg/services/org"
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
	_                resourcepb.ResourceIndexClient = (*UserLegacySearchClient)(nil)
	fieldLogin                                      = fmt.Sprintf("%s%s", resource.SEARCH_FIELD_PREFIX, builders.USER_LOGIN)
	fieldEmail                                      = fmt.Sprintf("%s%s", resource.SEARCH_FIELD_PREFIX, builders.USER_EMAIL)
	fieldLastSeenAt                                 = fmt.Sprintf("%s%s", resource.SEARCH_FIELD_PREFIX, builders.USER_LAST_SEEN_AT)
	fieldRole                                       = fmt.Sprintf("%s%s", resource.SEARCH_FIELD_PREFIX, builders.USER_ROLE)
	wildcardsMatcher                                = regexp.MustCompile(`[\*\?\\]`)

	userSortFieldMapping = map[string]string{
		fieldLastSeenAt:             "lastSeenAtAge",
		resource.SEARCH_FIELD_TITLE: "name",
		fieldLogin:                  "login",
		fieldEmail:                  "email",
	}
)

// UserLegacySearchClient is a client for searching for users in the legacy search engine.
type UserLegacySearchClient struct {
	resourcepb.ResourceIndexClient
	orgService org.Service
	log        log.Logger
	tracer     trace.Tracer
	cfg        *setting.Cfg
}

// NewUserLegacySearchClient creates a new UserLegacySearchClient.
func NewUserLegacySearchClient(orgService org.Service, tracer trace.Tracer, cfg *setting.Cfg) *UserLegacySearchClient {
	return &UserLegacySearchClient{
		orgService: orgService,
		log:        log.New("grafana-apiserver.users.legacy-search"),
		tracer:     tracer,
		cfg:        cfg,
	}
}

// Search searches for users in the legacy search engine.
// It only supports exact matching for title, login, or email.
func (c *UserLegacySearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	ctx, span := c.tracer.Start(ctx, "user.legacysearch")
	defer span.End()

	logger := c.log.FromContext(ctx)

	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	if req.Limit > common.MaxListLimit {
		return nil, fmt.Errorf("limit cannot be greater than %d", common.MaxListLimit)
	}
	if req.Limit < 1 {
		req.Limit = common.DefaultListLimit
	}

	if req.Page > math.MaxInt32 || req.Page < 0 {
		return nil, fmt.Errorf("invalid page number: %d", req.Page)
	}

	if req.Page < 1 {
		req.Page = 1
	}

	legacySortOptions := legacysort.ConvertToSortOptions(req.SortBy, userSortFieldMapping, sortopts.SortOptionsByQueryParam)

	query := &org.SearchOrgUsersQuery{
		OrgID:    signedInUser.GetOrgID(),
		Limit:    int(req.Limit),
		Page:     int(req.Page),
		SortOpts: legacySortOptions,

		User: signedInUser,
	}

	var title, login, email string
	for _, field := range req.Options.Fields {
		vals := field.GetValues()
		if len(vals) != 1 {
			logger.Warn("only single value fields are supported for legacy search, using first value", "field", field.Key, "values", vals)
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

	// Unified search `query` has wildcards, but legacy search does not support them.
	// We have to remove them here to make legacy search work as expected with SQL LIKE queries.
	if req.Query != "" {
		query.Query = wildcardsMatcher.ReplaceAllString(req.Query, "")
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
		span.RecordError(err)
		span.SetStatus(codes.Error, "user legacy search failed")
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
