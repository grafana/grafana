package authinfoservice

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

const genericOAuthModule = "oauth_generic_oauth"

var (
	logger log.Logger
)

func init() {
	registry.RegisterService(&Implementation{})
}

type Service interface {
	LookupAndUpdate(query *models.GetUserByAuthInfoQuery) (*models.User, error)
}

type Implementation struct {
	Bus      bus.Bus            `inject:""`
	SQLStore *sqlstore.SQLStore `inject:""`
}

func (s *Implementation) Init() error {
	return nil
}

func (s *Implementation) getUserById(id int64) (bool, *models.User, error) {
	var (
		has  bool
		err  error
		user *models.User
	)
	err = s.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		has, err = sess.ID(id).Get(user)
		return err
	})
	if err != nil {
		return false, nil, err
	}

	return has, user, nil
}

func (s *Implementation) getUser(user *models.User) (has bool, err error) {
	s.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		has, err = sess.Get(user)
		return err
	})
	return
}

func (s *Implementation) LookupAndFix(query *models.GetUserByAuthInfoQuery) (*models.User, *models.UserAuth, error) {
	authQuery := &models.GetAuthInfoQuery{}

	// Try to find the user by auth module and id first
	if query.AuthModule != "" && query.AuthId != "" {
		authQuery.AuthModule = query.AuthModule
		authQuery.AuthId = query.AuthId

		err := s.Bus.Dispatch(authQuery)
		if !errors.Is(err, models.ErrUserNotFound) {
			if err != nil {
				return nil, nil, err
			}

			// if user id was specified and doesn't match the user_auth entry, remove it
			if query.UserId != 0 && query.UserId != authQuery.Result.UserId {
				err = s.Bus.Dispatch(&models.DeleteAuthInfoCommand{
					UserAuth: authQuery.Result,
				})
				if err != nil {
					logger.Error("Error removing user_auth entry", "error", err)
				}

				return nil, nil, models.ErrUserNotFound
			} else {
				has, user, err := s.getUserById(authQuery.UserId)
				if err != nil {
					return nil, nil, err
				}

				if !has {
					// if the user has been deleted then remove the entry
					err = bus.Dispatch(&models.DeleteAuthInfoCommand{
						UserAuth: authQuery.Result,
					})
					if err != nil {
						logger.Error("Error removing user_auth entry", "error", err)
					}

					return nil, nil, models.ErrUserNotFound
				}

				return user, authQuery.Result, nil
			}
		}
	}

	return nil, nil, models.ErrUserNotFound
}

func (s *Implementation) LookupAndUpdate(query *models.GetUserByAuthInfoQuery) (*models.User, error) {
	// 1. LookupAndFix = auth info, user, error
	// 2. FindByUserDetails
	// 3. Update
	// return user, error

	user := &models.User{}
	has := false
	var err error
	user, authInfo, err := s.LookupAndFix(query)
	// this is where I am, not sure where to go next.

	// If not found, try to find the user by id
	if !has && query.UserId != 0 {
		has, user, err = s.getUserById(query.UserId)
		if err != nil {
			return nil, err
		}
	}

	// If not found, try to find the user by email address
	if !has && query.Email != "" {
		user = &models.User{Email: query.Email}
		has, err = s.getUser(user)
		if err != nil {
			return nil, err
		}
	}

	// If not found, try to find the user by login
	if !has && query.Login != "" {
		user = &models.User{Login: query.Login}
		has, err = s.getUser(user)
		if err != nil {
			return nil, err
		}
	}

	// No user found
	if !has {
		return nil, models.ErrUserNotFound
	}

	// Special case for generic oauth duplicates
	if query.AuthModule == genericOAuthModule && user.Id != 0 {
		authQuery.UserId = user.Id
		authQuery.AuthModule = query.AuthModule
		err = bus.Dispatch(authQuery)
		if !errors.Is(err, models.ErrUserNotFound) {
			if err != nil {
				return nil, err
			}
		}
	}
	if authQuery.Result == nil && query.AuthModule != "" {
		cmd2 := &models.SetAuthInfoCommand{
			UserId:     user.Id,
			AuthModule: query.AuthModule,
			AuthId:     query.AuthId,
		}
		if err := bus.Dispatch(cmd2); err != nil {
			return nil, err
		}
	}

	return user, nil
}
