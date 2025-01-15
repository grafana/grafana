package rbac

import (
	"bytes"
	"context"
	"encoding/gob"
	"errors"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/authz/rbac/store"
)

func userIdentifierCacheKey(namespace, userUID string) string {
	return namespace + ".uid_" + userUID
}

func userIdentifierCacheKeyById(namespace, ID string) string {
	return namespace + ".id_" + ID
}

func anonymousPermCacheKey(namespace, action string) string {
	return namespace + ".perm_anonymous_" + action
}

func userPermCacheKey(namespace, userUID, action string) string {
	return namespace + ".perm_" + userUID + "_" + action
}

func userBasicRoleCacheKey(namespace, userUID string) string {
	return namespace + ".basic_role_" + userUID
}

func userTeamCacheKey(namespace, userUID string) string {
	return namespace + ".team_" + userUID
}

func folderCacheKey(namespace string) string {
	return namespace + ".folders"
}

func (s *Service) getUserPermissionsFromCache(ctx context.Context, key string) (map[string]bool, bool) {
	cached, err := s.cache.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, remotecache.ErrCacheItemNotFound) {
			s.logger.Warn("Failed to get user permissions from cache", "error", err)
		}
		return nil, false
	}

	userPerm := make(map[string]bool)
	err = gob.NewDecoder(bytes.NewBuffer(cached)).Decode(&userPerm)
	if err != nil {
		s.logger.Warn("Failed to decode user permissions", "error", err)
		return nil, false
	}

	return userPerm, true
}

func (s *Service) setUserPermissionsToCache(ctx context.Context, key string, userPerm map[string]bool) {
	if userPerm == nil {
		s.logger.Debug("Skip set user permissions to cache, user permissions is nil")
		return
	}

	var buf bytes.Buffer
	err := gob.NewEncoder(&buf).Encode(userPerm)
	if err != nil {
		s.logger.Warn("Failed to encode user permissions", "error", err)
		return
	}

	err = s.cache.Set(ctx, key, buf.Bytes(), s.permTTL)
	if err != nil {
		s.logger.Warn("Failed to set user permissions to cache", "error", err)
	}
}

func (s *Service) getUserIdentifiersFromCache(ctx context.Context, key string) (*store.UserIdentifiers, bool) {
	cached, err := s.cache.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, remotecache.ErrCacheItemNotFound) {
			s.logger.Warn("Failed to get user identifiers from cache", "error", err)
		}
		return nil, false
	}

	identifiers := &store.UserIdentifiers{}
	err = gob.NewDecoder(bytes.NewBuffer(cached)).Decode(identifiers)
	if err != nil {
		s.logger.Warn("Failed to decode user identifiers", "error", err)
		return nil, false
	}
	return identifiers, true
}

func (s *Service) setUserIdentifiersToCache(ctx context.Context, key string, identifiers *store.UserIdentifiers) {
	if identifiers == nil {
		s.logger.Debug("Skip set user identifiers to cache, identifiers is nil")
		return
	}

	var buf bytes.Buffer
	err := gob.NewEncoder(&buf).Encode(identifiers)
	if err != nil {
		s.logger.Warn("Failed to encode user identifiers", "error", err)
		return
	}

	err = s.cache.Set(ctx, key, buf.Bytes(), s.idTTL)
	if err != nil {
		s.logger.Warn("Failed to set user identifiers to cache", "error", err)
	}
}

func (s *Service) getUserTeamsFromCache(ctx context.Context, key string) ([]int64, bool) {
	cached, err := s.cache.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, remotecache.ErrCacheItemNotFound) {
			s.logger.Warn("Failed to get user teams from cache", "error", err)
		}
		return nil, false
	}

	teams := []int64{}
	err = gob.NewDecoder(bytes.NewBuffer(cached)).Decode(&teams)
	if err != nil {
		s.logger.Warn("Failed to decode user teams", "error", err)
		return nil, false
	}

	return teams, true
}

func (s *Service) setUserTeamsToCache(ctx context.Context, key string, teams []int64) {
	if teams == nil {
		s.logger.Debug("Skip set user teams to cache, teams is nil")
		return
	}

	var buf bytes.Buffer
	err := gob.NewEncoder(&buf).Encode(teams)
	if err != nil {
		s.logger.Warn("Failed to encode user teams", "error", err)
		return
	}

	err = s.cache.Set(ctx, key, buf.Bytes(), s.teamTTL)
	if err != nil {
		s.logger.Warn("Failed to set user teams to cache", "error", err)
	}
}

func (s *Service) getUserBasicRoleFromCache(ctx context.Context, key string) (*store.BasicRole, bool) {
	cached, err := s.cache.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, remotecache.ErrCacheItemNotFound) {
			s.logger.Warn("Failed to get user basic role from cache", "error", err)
		}
		return nil, false
	}

	basicRole := &store.BasicRole{}
	err = gob.NewDecoder(bytes.NewBuffer(cached)).Decode(basicRole)
	if err != nil {
		s.logger.Warn("Failed to decode user basic role", "error", err)
		return nil, false
	}

	return basicRole, true
}

func (s *Service) setUserBasicRoleToCache(ctx context.Context, key string, basicRole *store.BasicRole) {
	if basicRole == nil {
		s.logger.Debug("Skip set user basic role to cache, basic role is nil")
		return
	}

	var buf bytes.Buffer
	err := gob.NewEncoder(&buf).Encode(basicRole)
	if err != nil {
		s.logger.Warn("Failed to encode user basic role", "error", err)
		return
	}

	err = s.cache.Set(ctx, key, buf.Bytes(), s.basicRoleTTL)
	if err != nil {
		s.logger.Warn("Failed to set user basic role to cache", "error", err)
	}
}

func (s *Service) getFolderFromCache(ctx context.Context, key string) (map[string]FolderNode, bool) {
	cached, err := s.cache.Get(ctx, key)
	if err != nil {
		if !errors.Is(err, remotecache.ErrCacheItemNotFound) {
			s.logger.Warn("Failed to get folder from cache", "error", err)
		}
		return nil, false
	}

	folder := make(map[string]FolderNode)
	err = gob.NewDecoder(bytes.NewBuffer(cached)).Decode(&folder)
	if err != nil {
		s.logger.Warn("Failed to decode folder", "error", err)
		return nil, false
	}

	return folder, true
}

func (s *Service) setFolderToCache(ctx context.Context, key string, folder map[string]FolderNode) {
	if folder == nil {
		s.logger.Debug("Skip set folder to cache, folder is nil")
		return
	}

	var buf bytes.Buffer
	err := gob.NewEncoder(&buf).Encode(folder)
	if err != nil {
		s.logger.Warn("Failed to encode folder", "error", err)
		return
	}

	err = s.cache.Set(ctx, key, buf.Bytes(), s.folderTTL)
	if err != nil {
		s.logger.Warn("Failed to set folder to cache", "error", err)
	}
}
