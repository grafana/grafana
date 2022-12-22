package supportbundlesimpl

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/infra/supportbundles"
	"github.com/grafana/grafana/pkg/services/user"
)

func userCollector(users user.Service) supportbundles.Collector {
	collectorFn := func(ctx context.Context) (*supportbundles.SupportItem, error) {
		query := &user.SearchUsersQuery{
			SignedInUser: &user.SignedInUser{},
			OrgID:        0,
			Query:        "",
			Page:         0,
			Limit:        0,
			AuthModule:   "",
			Filters:      []user.Filter{},
			IsDisabled:   new(bool),
		}
		res, err := users.Search(ctx, query)
		if err != nil {
			return nil, err
		}

		userBytes, err := json.Marshal(res.Users)
		if err != nil {
			return nil, err
		}

		return &supportbundles.SupportItem{
			Filename:  "users.json",
			FileBytes: userBytes,
		}, nil
	}

	return supportbundles.Collector{
		UID:               "users",
		Description:       "User information",
		DisplayName:       "A list of users of the Grafana instance",
		IncludedByDefault: false,
		Default:           true,
		Fn:                collectorFn,
	}
}
