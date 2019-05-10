package user

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/models"
)

// UpsertArgs are object for Upsert method
type UpsertArgs struct {
	ReqContext    *models.ReqContext
	ExternalUser  *models.ExternalUserInfo
	SignupAllowed bool
}

// Upsert add/update grafana user
func Upsert(args *UpsertArgs) (*models.User, error) {
	query := &models.UpsertUserCommand{
		ReqContext:    args.ReqContext,
		ExternalUser:  args.ExternalUser,
		SignupAllowed: args.SignupAllowed,
	}
	err := bus.Dispatch(query)
	if err != nil {
		return nil, err
	}

	return query.Result, nil
}

// Get the users
func Get(
	query *models.SearchUsersQuery,
) ([]*models.UserSearchHitDTO, error) {
	if err := bus.Dispatch(query); err != nil {
		return nil, err
	}

	return query.Result.Users, nil
}
