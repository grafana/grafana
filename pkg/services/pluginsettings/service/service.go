package service

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/db"
)

func ProvideService(db db.DB, secretsService secrets.Service) *Service {
	s := &Service{
		db: db,
		decryptionCache: secureJSONDecryptionCache{
			cache: make(map[int64]cachedDecryptedJSON),
		},
		secretsService: secretsService,
		logger:         log.New("pluginsettings"),
	}

	return s
}

type Service struct {
	db              db.DB
	decryptionCache secureJSONDecryptionCache
	secretsService  secrets.Service

	logger log.Logger
}

type cachedDecryptedJSON struct {
	updated time.Time
	json    map[string]string
}

type secureJSONDecryptionCache struct {
	cache map[int64]cachedDecryptedJSON
	sync.Mutex
}

func (s *Service) GetPluginSettings(ctx context.Context, args *pluginsettings.GetArgs) ([]*pluginsettings.DTO, error) {
	ps, err := s.getPluginSettings(ctx, args.OrgID)
	if err != nil {
		return nil, err
	}

	var result []*pluginsettings.DTO
	for _, p := range ps {
		result = append(result, &pluginsettings.DTO{
			ID:             p.Id,
			OrgID:          p.OrgId,
			PluginID:       p.PluginId,
			PluginVersion:  p.PluginVersion,
			JSONData:       p.JsonData,
			SecureJSONData: p.SecureJsonData,
			Enabled:        p.Enabled,
			Pinned:         p.Pinned,
			Updated:        p.Updated,
		})
	}

	return result, nil
}

func (s *Service) GetPluginSettingByPluginID(ctx context.Context, args *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
	query := &models.GetPluginSettingByIdQuery{
		OrgId:    args.OrgID,
		PluginId: args.PluginID,
	}

	err := s.getPluginSettingById(ctx, query)
	if err != nil {
		return nil, err
	}

	return &pluginsettings.DTO{
		ID:             query.Result.Id,
		OrgID:          query.Result.OrgId,
		PluginID:       query.Result.PluginId,
		PluginVersion:  query.Result.PluginVersion,
		JSONData:       query.Result.JsonData,
		SecureJSONData: query.Result.SecureJsonData,
		Enabled:        query.Result.Enabled,
		Pinned:         query.Result.Pinned,
		Updated:        query.Result.Updated,
	}, nil
}

func (s *Service) UpdatePluginSetting(ctx context.Context, args *pluginsettings.UpdateArgs) error {
	encryptedSecureJsonData, err := s.secretsService.EncryptJsonData(ctx, args.SecureJSONData, secrets.WithoutScope())
	if err != nil {
		return err
	}

	return s.updatePluginSetting(ctx, &models.UpdatePluginSettingCmd{
		Enabled:                 args.Enabled,
		Pinned:                  args.Pinned,
		JsonData:                args.JSONData,
		SecureJsonData:          args.SecureJSONData,
		PluginVersion:           args.PluginVersion,
		PluginId:                args.PluginID,
		OrgId:                   args.OrgID,
		EncryptedSecureJsonData: encryptedSecureJsonData,
	})
}

func (s *Service) UpdatePluginSettingPluginVersion(ctx context.Context, args *pluginsettings.UpdatePluginVersionArgs) error {
	return s.updatePluginSettingVersion(ctx, &models.UpdatePluginSettingVersionCmd{
		PluginVersion: args.PluginVersion,
		PluginId:      args.PluginID,
		OrgId:         args.OrgID,
	})
}

func (s *Service) DecryptedValues(ps *pluginsettings.DTO) map[string]string {
	s.decryptionCache.Lock()
	defer s.decryptionCache.Unlock()

	if item, present := s.decryptionCache.cache[ps.ID]; present && ps.Updated.Equal(item.updated) {
		return item.json
	}

	json, err := s.secretsService.DecryptJsonData(context.Background(), ps.SecureJSONData)
	if err != nil {
		s.logger.Error("Failed to decrypt secure json data", "error", err)
		return map[string]string{}
	}

	s.decryptionCache.cache[ps.ID] = cachedDecryptedJSON{
		updated: ps.Updated,
		json:    json,
	}

	return json
}

func (s *Service) getPluginSettings(ctx context.Context, orgID int64) ([]*models.PluginSetting, error) {
	sql := `SELECT org_id, plugin_id, enabled, pinned, plugin_version FROM plugin_setting `
	params := make([]interface{}, 0)

	if orgID != 0 {
		sql += "WHERE org_id=?"
		params = append(params, orgID)
	}

	var rslt []*models.PluginSetting
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return sess.SQL(sql, params...).Find(&rslt)
	})
	if err != nil {
		return nil, err
	}

	return rslt, nil
}

func (s *Service) getPluginSettingById(ctx context.Context, query *models.GetPluginSettingByIdQuery) error {
	return s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		pluginSetting := models.PluginSetting{OrgId: query.OrgId, PluginId: query.PluginId}
		has, err := sess.Get(&pluginSetting)
		if err != nil {
			return err
		} else if !has {
			return models.ErrPluginSettingNotFound
		}
		query.Result = &pluginSetting
		return nil
	})
}

func (s *Service) updatePluginSetting(ctx context.Context, cmd *models.UpdatePluginSettingCmd) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var pluginSetting models.PluginSetting

		exists, err := sess.Where("org_id=? and plugin_id=?", cmd.OrgId, cmd.PluginId).Get(&pluginSetting)
		if err != nil {
			return err
		}
		sess.UseBool("enabled")
		sess.UseBool("pinned")
		if !exists {
			pluginSetting = models.PluginSetting{
				PluginId:       cmd.PluginId,
				OrgId:          cmd.OrgId,
				Enabled:        cmd.Enabled,
				Pinned:         cmd.Pinned,
				JsonData:       cmd.JsonData,
				PluginVersion:  cmd.PluginVersion,
				SecureJsonData: cmd.EncryptedSecureJsonData,
				Created:        time.Now(),
				Updated:        time.Now(),
			}

			// add state change event on commit success
			sess.PublishAfterCommit(&models.PluginStateChangedEvent{
				PluginId: cmd.PluginId,
				OrgId:    cmd.OrgId,
				Enabled:  cmd.Enabled,
			})

			_, err = sess.Insert(&pluginSetting)
			return err
		}

		for key, encryptedData := range cmd.EncryptedSecureJsonData {
			pluginSetting.SecureJsonData[key] = encryptedData
		}

		// add state change event on commit success
		if pluginSetting.Enabled != cmd.Enabled {
			sess.PublishAfterCommit(&models.PluginStateChangedEvent{
				PluginId: cmd.PluginId,
				OrgId:    cmd.OrgId,
				Enabled:  cmd.Enabled,
			})
		}

		pluginSetting.Updated = time.Now()
		pluginSetting.Enabled = cmd.Enabled
		pluginSetting.JsonData = cmd.JsonData
		pluginSetting.Pinned = cmd.Pinned
		pluginSetting.PluginVersion = cmd.PluginVersion

		_, err = sess.ID(pluginSetting.Id).Update(&pluginSetting)
		return err
	})
}

func (s *Service) updatePluginSettingVersion(ctx context.Context, cmd *models.UpdatePluginSettingVersionCmd) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Exec("UPDATE plugin_setting SET plugin_version=? WHERE org_id=? AND plugin_id=?", cmd.PluginVersion, cmd.OrgId, cmd.PluginId)
		return err
	})
}
