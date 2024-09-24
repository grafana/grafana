package externalsessionimpl

import (
	"context"
	"encoding/base64"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/secrets"
)

var _ auth.ExternalSessionStore = (*Store)(nil)

type Store struct {
	sqlStore       db.DB
	secretsService secrets.Service
}

func ProvideStore(sqlStore db.DB, secretService secrets.Service) auth.ExternalSessionStore {
	return &Store{
		sqlStore:       sqlStore,
		secretsService: secretService,
	}
}

func (s *Store) GetExternalSession(ctx context.Context, extSessionID int64) (*auth.ExternalSession, error) {
	externalSession := &auth.ExternalSession{ID: extSessionID}

	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		found, err := sess.Get(externalSession)
		if err != nil {
			return err
		}

		if !found {
			return auth.ErrExternalSessionNotFound
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return externalSession, nil
}

func (s *Store) FindExternalSessions(ctx context.Context, query *auth.GetExternalSessionQuery) ([]*auth.ExternalSession, error) {
	externalSession := &auth.ExternalSession{}
	if query.ID != 0 {
		externalSession.ID = query.ID
	}

	if query.SessionIndex != "" {
		externalSession.SessionID = query.SessionIndex
	}

	if query.NameID != "" {
		externalSession.NameID = query.NameID
	}

	result := make([]*auth.ExternalSession, 0)
	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Find(&result, externalSession)
	})

	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *Store) CreateExternalSession(ctx context.Context, externalSession *auth.ExternalSession) error {
	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(externalSession)
		return err
	})
	return err
}

func (s *Store) DeleteExternalSession(ctx context.Context, id int64) error {
	externalSession := &auth.ExternalSession{ID: id}
	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Delete(externalSession)
		return err
	})
	return err
}

func (s *Store) LookupExternalSessionByAuthID(ctx context.Context, userAuthID int64) (*auth.ExternalSession, error) {
	externalSessio := &auth.ExternalSession{UserAuthID: userAuthID}
	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		found, err := sess.Get(externalSessio)
		if err != nil {
			return err
		}

		if !found {
			return auth.ErrExternalSessionNotFound
		}

		return nil
	})
	if err != nil {
		return nil, err
	}
	return externalSessio, nil
}

func (s *Store) LookupExternalSessionBySessionID(ctx context.Context, sessionID string) (*auth.ExternalSession, error) {
	session := &auth.ExternalSession{SessionID: sessionID}
	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		found, err := sess.Get(session)
		if err != nil {
			return err
		}

		if !found {
			return auth.ErrExternalSessionNotFound
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return session, nil
}

func (s *Store) encryptAndEncode(str string) (string, error) {
	encrypted, err := s.secretsService.Encrypt(context.Background(), []byte(str), secrets.WithoutScope())
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(encrypted), nil
}
