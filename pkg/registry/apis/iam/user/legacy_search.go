package user

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strconv"

	"google.golang.org/grpc"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	res "github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	UserResource      = "users"
	UserResourceGroup = "iam.grafana.com"
)

// UserLegacySearchClient is a client for searching for users in the legacy search engine.
type UserLegacySearchClient struct {
	resourcepb.ResourceIndexClient
	userService user.Service
	log         *slog.Logger
}

// NewUserLegacySearchClient creates a new UserLegacySearchClient.
func NewUserLegacySearchClient(userService user.Service) *UserLegacySearchClient {
	return &UserLegacySearchClient{
		userService: userService,
		log:         slog.Default().With("logger", "legacy-user-search-client"),
	}
}

// Search searches for users in the legacy search engine.
// It only supports exact matching for title, login, or email.
func (c *UserLegacySearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	signedInUser, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	if req.Limit > 100 {
		req.Limit = 100
	}

	if req.Page > math.MaxInt32 {
		return nil, fmt.Errorf("invalid page number: %d", req.Page)
	}

	query := &user.SearchUsersQuery{
		SignedInUser: signedInUser,
		Limit:        int(req.Limit),
		Page:         int(req.Page),
	}

	var title, login, email string
	for _, field := range req.Options.Fields {
		vals := field.GetValues()
		if len(vals) != 1 {
			c.log.Warn("only single value fields are supported for legacy search, using first value", "field", field.Key, "values", vals)
		}
		switch field.Key {
		case res.SEARCH_FIELD_TITLE:
			title = vals[0]
		case "fields.login":
			login = vals[0]
		case "fields.email":
			email = vals[0]
		}
	}

	if title == "" && login == "" && email == "" {
		return nil, fmt.Errorf("at least one of title, login, or email must be provided for the query")
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

	columns := getColumns()
	list := &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: columns,
		},
	}

	res, err := c.userService.Search(ctx, query)
	if err != nil {
		return nil, err
	}

	for _, u := range res.Users {
		cells := createBaseCells(u)
		list.Results.Rows = append(list.Results.Rows, &resourcepb.ResourceTableRow{
			Key:   getResourceKey(u, req.Options.Key.Namespace),
			Cells: cells,
		})
	}

	list.TotalHits = res.TotalCount
	return list, nil
}

func getResourceKey(item *user.UserSearchHitDTO, namespace string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{
		Namespace: namespace,
		Group:     UserResourceGroup,
		Resource:  UserResource,
		Name:      item.UID,
	}
}

func getColumns() []*resourcepb.ResourceTableColumnDefinition {
	searchFields := res.StandardSearchFields()
	return []*resourcepb.ResourceTableColumnDefinition{
		searchFields.Field(res.SEARCH_FIELD_TITLE),
		searchFields.Field(res.SEARCH_FIELD_LEGACY_ID),
	}
}

func createBaseCells(u *user.UserSearchHitDTO) [][]byte {
	return [][]byte{
		[]byte(u.Name),
		[]byte(strconv.FormatInt(u.ID, 10)),
		[]byte(u.Email),
		[]byte(u.Login),
	}
}
