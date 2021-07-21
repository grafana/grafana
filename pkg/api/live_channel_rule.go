package api

import (
	"context"
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

//go:generate mockgen -destination=live_channel_rule_mock.go -package=api github.com/grafana/grafana/pkg/api ChannelRuleStorage

type ChannelRuleStorage interface {
	ListChannelRules(ctx context.Context, cmd models.ListLiveChannelRuleCommand) ([]*models.LiveChannelRule, error)
	GetChannelRule(ctx context.Context, cmd models.GetLiveChannelRuleCommand) (*models.LiveChannelRule, error)
	CreateChannelRule(ctx context.Context, cmd models.CreateLiveChannelRuleCommand) (*models.LiveChannelRule, error)
	UpdateChannelRule(ctx context.Context, cmd models.UpdateLiveChannelRuleCommand) (*models.LiveChannelRule, error)
	DeleteChannelRule(ctx context.Context, cmd models.DeleteLiveChannelRuleCommand) (int64, error)
}

type channelRuleAPI struct {
	storage ChannelRuleStorage
}

func (a *channelRuleAPI) ListChannelRules(c *models.ReqContext) response.Response {
	query := models.ListLiveChannelRuleCommand{OrgId: c.OrgId}

	result, err := a.storage.ListChannelRules(c.Req.Context(), query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to query channel rules", err)
	}

	items := make([]dtos.LiveChannelRuleListItem, 0, len(result))

	for _, ch := range result {
		item := dtos.LiveChannelRuleListItem{
			Uid:     ch.Uid,
			Version: ch.Version,
			Pattern: ch.Pattern,
		}
		items = append(items, item)
	}
	return response.JSON(http.StatusOK, &items)
}

func liveChannelToDTO(ch *models.LiveChannelRule) dtos.LiveChannelRule {
	item := dtos.LiveChannelRule{
		Uid:              ch.Uid,
		Version:          ch.Version,
		Pattern:          ch.Pattern,
		Config:           ch.Settings,
		SecureJsonFields: map[string]bool{},
	}
	for k, v := range ch.SecureSettings {
		if len(v) > 0 {
			item.SecureJsonFields[k] = true
		}
	}
	return item
}

func (a *channelRuleAPI) GetChannelRuleByUid(c *models.ReqContext) response.Response {
	query := models.GetLiveChannelRuleCommand{
		Uid:   c.Params(":uid"),
		OrgId: c.OrgId,
	}

	result, err := a.storage.GetChannelRule(c.Req.Context(), query)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return response.Error(http.StatusNotFound, "Channel rule not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to query channel rule", err)
	}
	item := liveChannelToDTO(result)
	return response.JSON(http.StatusOK, &item)
}

func (a *channelRuleAPI) CreateChannelRule(c *models.ReqContext, cmd models.CreateLiveChannelRuleCommand) response.Response {
	cmd.OrgId = c.OrgId

	result, err := a.storage.CreateChannelRule(c.Req.Context(), cmd)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleExists) {
			return response.Error(http.StatusConflict, err.Error(), err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to create channel rule", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message":     "channel rule added",
		"uid":         result.Uid,
		"channelRule": liveChannelToDTO(result),
	})
}

func (a *channelRuleAPI) fillChannelRuleWithSecureJSONData(ctx context.Context, cmd *models.UpdateLiveChannelRuleCommand) error {
	if len(cmd.SecureSettings) == 0 {
		return nil
	}

	rule, err := a.storage.GetChannelRule(ctx, models.GetLiveChannelRuleCommand{
		OrgId: cmd.OrgId,
		Uid:   cmd.Uid,
	})
	if err != nil {
		return err
	}

	secureJSONData := rule.SecureSettings.Decrypt()
	for k, v := range secureJSONData {
		if _, ok := cmd.SecureSettings[k]; !ok {
			cmd.SecureSettings[k] = v
		}
	}

	return nil
}

func (a *channelRuleAPI) UpdateChannelRule(c *models.ReqContext, cmd models.UpdateLiveChannelRuleCommand) response.Response {
	cmd.Uid = c.Params(":uid")
	cmd.OrgId = c.OrgId

	err := a.fillChannelRuleWithSecureJSONData(c.Req.Context(), &cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to update channel rule", err)
	}

	_, err = a.storage.UpdateChannelRule(c.Req.Context(), cmd)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return response.Error(http.StatusNotFound, "Channel rule not found", nil)
		}
		if errors.Is(err, models.ErrLiveChannelRuleUpdatingOldVersion) {
			return response.Error(http.StatusConflict, "Channel rule has already been updated by someone else. Please reload and try again", err)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update channel rule", err)
	}

	getCmd := models.GetLiveChannelRuleCommand{
		Uid:   cmd.Uid,
		OrgId: c.OrgId,
	}

	result, err := a.storage.GetChannelRule(c.Req.Context(), getCmd)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return response.Error(http.StatusNotFound, "Channel rule not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to query channel rule", err)
	}

	return response.JSON(http.StatusOK, util.DynMap{
		"message":     "channel rule updated",
		"uid":         cmd.Uid,
		"channelRule": liveChannelToDTO(result),
	})
}

func (a *channelRuleAPI) DeleteChannelRuleById(c *models.ReqContext) response.Response {
	uid := c.Params(":uid")

	if uid == "" {
		return response.Error(http.StatusBadRequest, "Missing channel rule uid", nil)
	}

	getCmd := models.GetLiveChannelRuleCommand{
		Uid:   uid,
		OrgId: c.OrgId,
	}
	_, err := a.storage.GetChannelRule(c.Req.Context(), getCmd)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return response.Error(http.StatusNotFound, "Channel rule not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to query channel rule", err)
	}

	cmd := models.DeleteLiveChannelRuleCommand{Uid: uid, OrgId: c.OrgId}
	_, err = a.storage.DeleteChannelRule(c.Req.Context(), cmd)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to delete channel rule", err)
	}
	return response.Success("Channel rule deleted")
}
