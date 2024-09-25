package externalsessionimpl

import (
	"context"
	"crypto/sha256"
	"encoding/base64"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/secrets"
)

var _ auth.ExternalSessionStore = (*Store)(nil)

type Store struct {
	sqlStore       db.DB
	secretsService secrets.Service
	tracer         tracing.Tracer
}

func ProvideStore(sqlStore db.DB, secretService secrets.Service, tracer tracing.Tracer) auth.ExternalSessionStore {
	return &Store{
		sqlStore:       sqlStore,
		secretsService: secretService,
		tracer:         tracer,
	}
}

func (s *Store) GetExternalSession(ctx context.Context, extSessionID int64) (*auth.ExternalSession, error) {
	ctx, span := s.tracer.Start(ctx, "externalsession.GetExternalSession")
	defer span.End()

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
	ctx, span := s.tracer.Start(ctx, "externalsession.FindExternalSessions")
	defer span.End()

	externalSession := &auth.ExternalSession{}
	if query.ID != 0 {
		externalSession.ID = query.ID
	}

	if query.SessionIndex != "" {
		hash := sha256.New()
		hash.Write([]byte(query.SessionIndex))
		externalSession.SessionIDHash = base64.RawStdEncoding.EncodeToString(hash.Sum(nil))
	}

	if query.NameID != "" {
		hash := sha256.New()
		hash.Write([]byte(query.SessionIndex))
		externalSession.NameIDHash = base64.RawStdEncoding.EncodeToString(hash.Sum(nil))
	}

	queryResult := make([]*auth.ExternalSession, 0)
	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Find(&queryResult, externalSession)
	})
	if err != nil {
		return nil, err
	}

	for _, extSession := range queryResult {
		var err error
		extSession.AccessToken, err = s.decodeAndDecrypt(extSession.AccessToken)
		if err != nil {
			return nil, err
		}

		extSession.RefreshToken, err = s.decodeAndDecrypt(extSession.RefreshToken)
		if err != nil {
			return nil, err
		}

		extSession.IDToken, err = s.decodeAndDecrypt(extSession.IDToken)
		if err != nil {
			return nil, err
		}

		extSession.NameID, err = s.decodeAndDecrypt(extSession.NameID)
		if err != nil {
			return nil, err
		}

		extSession.SessionID, err = s.decodeAndDecrypt(extSession.SessionID)
		if err != nil {
			return nil, err
		}
	}
	return queryResult, nil
}

func (s *Store) CreateExternalSession(ctx context.Context, extSession *auth.ExternalSession) error {
	ctx, span := s.tracer.Start(ctx, "externalsession.CreateExternalSession")
	defer span.End()

	var err error
	clone := extSession.Clone()

	clone.AccessToken, err = s.encryptAndEncode(extSession.AccessToken)
	if err != nil {
		return err
	}

	clone.RefreshToken, err = s.encryptAndEncode(extSession.RefreshToken)
	if err != nil {
		return err
	}

	clone.IDToken, err = s.encryptAndEncode(extSession.IDToken)
	if err != nil {
		return err
	}

	if extSession.NameID != "" {
		hash := sha256.New()
		hash.Write([]byte(extSession.NameID))
		clone.NameIDHash = base64.RawStdEncoding.EncodeToString(hash.Sum(nil))
	}

	clone.NameID, err = s.encryptAndEncode(extSession.NameID)
	if err != nil {
		return err
	}

	if extSession.SessionID != "" {
		hash := sha256.New()
		hash.Write([]byte(extSession.SessionID))
		clone.SessionIDHash = base64.RawStdEncoding.EncodeToString(hash.Sum(nil))
	}

	clone.SessionID, err = s.encryptAndEncode(extSession.SessionID)
	if err != nil {
		return err
	}

	err = s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(clone)
		return err
	})
	if err != nil {
		return err
	}
	extSession.ID = clone.ID
	return nil
}

func (s *Store) DeleteExternalSession(ctx context.Context, ID int64) error {
	ctx, span := s.tracer.Start(ctx, "externalsession.DeleteExternalSession")
	defer span.End()

	externalSession := &auth.ExternalSession{ID: ID}
	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Delete(externalSession)
		return err
	})
	return err
}

func (s *Store) DeleteExternalSessionsByUserID(ctx context.Context, userID int64) error {
	ctx, span := s.tracer.Start(ctx, "externalsession.DeleteExternalSessionsByUserID")
	defer span.End()

	externalSession := &auth.ExternalSession{UserID: userID}
	err := s.sqlStore.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Delete(externalSession)
		return err
	})
	return err
}

func (s *Store) encryptAndEncode(str string) (string, error) {
	if str == "" {
		return "", nil
	}

	encrypted, err := s.secretsService.Encrypt(context.Background(), []byte(str), secrets.WithoutScope())
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(encrypted), nil
}

func (s *Store) decodeAndDecrypt(str string) (string, error) {
	// Bail out if empty string since it'll cause a segfault in Decrypt
	if str == "" {
		return "", nil
	}
	decoded, err := base64.StdEncoding.DecodeString(str)
	if err != nil {
		return "", err
	}
	decrypted, err := s.secretsService.Decrypt(context.Background(), decoded)
	if err != nil {
		return "", err
	}
	return string(decrypted), nil
}
