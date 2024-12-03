package authinfoimpl

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/user"
)

type Service struct {
	authInfoStore login.Store
	logger        log.Logger
	remoteCache   remotecache.CacheStorage
	secretService secrets.Service
}

const remoteCachePrefix = "authinfo-"
const remoteCacheTTL = 60 * time.Hour

var errMissingParameters = errutil.NewBase(errutil.StatusBadRequest, "auth-missing-parameters", errutil.WithPublicMessage("Missing parameters for auth info"))

func ProvideService(authInfoStore login.Store,
	remoteCache remotecache.CacheStorage,
	secretService secrets.Service) *Service {
	s := &Service{
		authInfoStore: authInfoStore,
		logger:        log.New("login.authinfo"),
		remoteCache:   remoteCache,
		secretService: secretService,
	}

	return s
}

func (s *Service) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	if query.UserId == 0 && query.AuthId == "" {
		return nil, user.ErrUserNotFound
	}

	authInfo, err := s.getAuthInfoFromCache(ctx, query)
	if err != nil && !errors.Is(err, remotecache.ErrCacheItemNotFound) {
		s.logger.Warn("failed to retrieve auth info from cache", "error", err)
	} else if authInfo != nil {
		return authInfo, nil
	}

	authInfo, err = s.authInfoStore.GetAuthInfo(ctx, query)
	if err != nil {
		return nil, err
	}

	err = s.setAuthInfoInCache(ctx, query, authInfo)
	if err != nil {
		s.logger.Warn("failed to set auth info in cache", "error", err)
	} else {
		s.logger.Debug("auth info set in cache", "cacheKey", generateCacheKey(query))
	}

	return authInfo, nil
}

func (s *Service) GetUserLabels(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
	if len(query.UserIDs) == 0 {
		return map[int64]string{}, nil
	}
	return s.authInfoStore.GetUserLabels(ctx, query)
}

func (s *Service) setAuthInfoInCache(ctx context.Context, query *login.GetAuthInfoQuery, info *login.UserAuth) error {
	cacheKey := generateCacheKey(query)
	infoJSON, err := json.Marshal(info)
	if err != nil {
		return err
	}

	encryptedInfo, err := s.secretService.Encrypt(ctx, infoJSON, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return s.remoteCache.Set(ctx, cacheKey, encryptedInfo, remoteCacheTTL)
}

func (s *Service) getAuthInfoFromCache(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	// check if we have the auth info in the remote cache
	cacheKey := generateCacheKey(query)
	item, err := s.remoteCache.Get(ctx, cacheKey)
	if err != nil {
		return nil, err
	}

	info := &login.UserAuth{}
	itemJSON, err := s.secretService.Decrypt(ctx, item)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(itemJSON, info); err != nil {
		return nil, err
	}

	s.logger.Debug("auth info retrieved from cache", "cacheKey", cacheKey)

	return info, nil
}

func generateCacheKey(query *login.GetAuthInfoQuery) string {
	cacheKey := remoteCachePrefix + strconv.FormatInt(query.UserId, 10) + "-" +
		query.AuthModule + "-" + query.AuthId
	return cacheKey
}

func (s *Service) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	// Only update auth info if we have an (user id + auth module)
	if cmd.UserId == 0 || cmd.AuthModule == "" {
		return errMissingParameters.Errorf("missing parameters for auth info %v", cmd)
	}

	if err := s.authInfoStore.UpdateAuthInfo(ctx, cmd); err != nil {
		return err
	}

	s.deleteUserAuthInfoInCache(ctx, &login.GetAuthInfoQuery{
		AuthModule: cmd.AuthModule,
		AuthId:     cmd.AuthId,
		UserId:     cmd.UserId,
	})

	return nil
}

func (s *Service) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	// Only set auth info if we have an (user id + auth module)
	if cmd.UserId == 0 || cmd.AuthModule == "" {
		return errMissingParameters.Errorf("missing parameters for auth info %v", cmd)
	}

	if err := s.authInfoStore.SetAuthInfo(ctx, cmd); err != nil {
		return err
	}

	s.deleteUserAuthInfoInCache(ctx, &login.GetAuthInfoQuery{
		AuthModule: cmd.AuthModule,
		AuthId:     cmd.AuthId,
		UserId:     cmd.UserId,
	})

	return nil
}

func (s *Service) DeleteUserAuthInfo(ctx context.Context, userID int64) error {
	err := s.authInfoStore.DeleteUserAuthInfo(ctx, userID)
	if err != nil {
		return err
	}

	err = s.remoteCache.Delete(ctx, generateCacheKey(&login.GetAuthInfoQuery{
		UserId: userID,
	}))
	if err != nil {
		s.logger.Error("failed to delete auth info from cache", "error", err)
	}

	return nil
}

func (s *Service) deleteUserAuthInfoInCache(ctx context.Context, query *login.GetAuthInfoQuery) {
	if query.AuthId != "" {
		err := s.remoteCache.Delete(ctx, generateCacheKey(&login.GetAuthInfoQuery{
			AuthModule: query.AuthModule,
			AuthId:     query.AuthId,
		}))
		if err != nil {
			s.logger.Warn("failed to delete auth info from cache", "error", err)
		}
	}

	if query.UserId != 0 {
		errN := s.remoteCache.Delete(ctx, generateCacheKey(
			&login.GetAuthInfoQuery{
				UserId: query.UserId,
			}))
		if errN != nil {
			s.logger.Warn("failed to delete user auth info from cache", "error", errN)
		}

		errA := s.remoteCache.Delete(ctx, generateCacheKey(
			&login.GetAuthInfoQuery{
				UserId:     query.UserId,
				AuthModule: query.AuthModule,
			}))
		if errA != nil {
			s.logger.Warn("failed to delete user module auth info from cache", "error", errA)
		}
	}
}
