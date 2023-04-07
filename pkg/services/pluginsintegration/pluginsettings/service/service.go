package service

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/secrets"
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

func (s *Service) GetPluginSettings(ctx context.Context, args *pluginsettings.GetArgs) ([]*pluginsettings.InfoDTO, error) {
	ps, err := s.getPluginSettingsInfo(ctx, args.OrgID)
	if err != nil {
		return nil, err
	}

	result := make([]*pluginsettings.InfoDTO, 0, len(ps))
	for _, p := range ps {
		result = append(result, &pluginsettings.InfoDTO{
			OrgID:         p.OrgID,
			PluginID:      p.PluginID,
			PluginVersion: p.PluginVersion,
			Enabled:       p.Enabled,
			Pinned:        p.Pinned,
		})
	}

	return result, nil
}

func (s *Service) GetPluginSettingByPluginID(ctx context.Context, args *pluginsettings.GetByPluginIDArgs) (*pluginsettings.DTO, error) {
	query := &pluginsettings.GetPluginSettingByIdQuery{
		OrgId:    args.OrgID,
		PluginId: args.PluginID,
	}

	err := s.getPluginSettingById(ctx, query)
	if err != nil {
		return nil, err
	}

	if query.Result == nil {
		return nil, pluginsettings.ErrPluginSettingNotFound
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

	return s.updatePluginSetting(ctx, &pluginsettings.UpdatePluginSettingCmd{
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
	return s.updatePluginSettingVersion(ctx, &pluginsettings.UpdatePluginSettingVersionCmd{
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

func (s *Service) getPluginSettingsInfo(ctx context.Context, orgID int64) ([]*pluginsettings.PluginSettingInfo, error) {
	sql := `SELECT org_id, plugin_id, enabled, pinned, plugin_version FROM plugin_setting `
	params := make([]interface{}, 0)

	if orgID != 0 {
		sql += "WHERE org_id=?"
		params = append(params, orgID)
	}

	var rslt []*pluginsettings.PluginSettingInfo
	err := s.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(sql, params...).Find(&rslt)
	})
	if err != nil {
		return nil, err
	}

	return rslt, nil
}

func (s *Service) getPluginSettingById(ctx context.Context, query *pluginsettings.GetPluginSettingByIdQuery) error {
	return s.db.WithDbSession(ctx, func(sess *db.Session) error {
		pluginSetting := pluginsettings.PluginSetting{OrgId: query.OrgId, PluginId: query.PluginId}
		has, err := sess.Get(&pluginSetting)
		if err != nil {
			return err
		} else if !has {
			return pluginsettings.ErrPluginSettingNotFound
		}
		query.Result = &pluginSetting
		return nil
	})
}

func (s *Service) updatePluginSetting(ctx context.Context, cmd *pluginsettings.UpdatePluginSettingCmd) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		var pluginSetting pluginsettings.PluginSetting

		exists, err := sess.Where("org_id=? and plugin_id=?", cmd.OrgId, cmd.PluginId).Get(&pluginSetting)
		if err != nil {
			return err
		}
		sess.UseBool("enabled")
		sess.UseBool("pinned")
		if !exists {
			pluginSetting = pluginsettings.PluginSetting{
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
			sess.PublishAfterCommit(&pluginsettings.PluginStateChangedEvent{
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
			sess.PublishAfterCommit(&pluginsettings.PluginStateChangedEvent{
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

func (s *Service) updatePluginSettingVersion(ctx context.Context, cmd *pluginsettings.UpdatePluginSettingVersionCmd) error {
	return s.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec("UPDATE plugin_setting SET plugin_version=? WHERE org_id=? AND plugin_id=?", cmd.PluginVersion, cmd.OrgId, cmd.PluginId)
		return err
	})
}
