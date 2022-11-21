package authimpl

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/setting"
)

type store interface {
	CreateToken(ctx context.Context, token userAuthToken) (*auth.UserToken, error)
}

var _ store = new(xormStore)

func newXormStore(db db.DB, cfg *setting.Cfg) *xormStore {
	return &xormStore{db, cfg}
}

type xormStore struct {
	db  db.DB
	cfg *setting.Cfg
}

func (s xormStore) CreateToken(ctx context.Context, token userAuthToken) (*auth.UserToken, error) {
	err := s.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		_, err := dbSession.Insert(&token)
		return err
	})

	if err != nil {
		return nil, err
	}

	var userToken *auth.UserToken
	if err := token.toUserToken(userToken); err != nil {
		return nil, err
	}

	return userToken, nil
}
