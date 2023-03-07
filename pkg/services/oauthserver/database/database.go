package database

// import (
// 	"context"

// 	"github.com/go-oauth2/oauth2/v4"

// 	"github.com/grafana/grafana/pkg/services/oauthserver"
// 	"github.com/grafana/grafana/pkg/infra/db"
// )

// // TODO store client_secret_hash instead of client_secret

// type Store struct {
// 	db db.DB
// }

// func NewStore(db db.DB) *Store {
// 	return &Store{
// 		db: db,
// 	}
// }

// var _ oauth2.ClientStore = &Store{}

// // SetFull set the client information
// func (s *Store) SetFull(ctx context.Context, cli *oauthserver.Client) error {
// 	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
// 		_, err := sess.Insert(*cli)
// 		return err
// 	})
// }

// // GetFullByID get the client information
// func (s *Store) GetFullByID(ctx context.Context, id string) (*oauthserver.Client, error) {
// 	res := oauthserver.Client{}
// 	if err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
// 		_, err := sess.Where("client_id = ?", id).Get(&res)
// 		return err
// 	}); err != nil {
// 		return nil, err
// 	}
// 	return &res, nil
// }

// // DeleteByID delete the client information
// func (s *Store) RemoveByID(ctx context.Context, id string) error {
// 	res := oauthserver.Client{}
// 	if err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
// 		_, err := sess.Where("client_id = ?", id).Delete(&res)
// 		return err
// 	}); err != nil {
// 		return err
// 	}
// 	return nil
// }

// // =============== gopkg.oauth2.v3.ClientStore ===============

// func (s *Store) GetByID(ctx context.Context, id string) (oauth2.ClientInfo, error) {
// 	res := oauthserver.Client{}
// 	if err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
// 		_, err := sess.Where("client_id = ?", id).Get(&res)
// 		return err
// 	}); err != nil {
// 		return nil, err
// 	}
// 	return &res, nil
// }
