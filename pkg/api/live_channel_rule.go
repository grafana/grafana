package api

import (
	"errors"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

//go:generate mockgen -destination=live_channel_rule_mock.go -package=api github.com/grafana/grafana/pkg/api ChannelRuleStorage

type ChannelRuleStorage interface {
	ListChannelRules(cmd models.ListLiveChannelRuleCommand) ([]*models.LiveChannelRule, error)
	GetChannelRule(cmd models.GetLiveChannelRuleCommand) (*models.LiveChannelRule, error)
	CreateChannelRule(cmd models.CreateLiveChannelRuleCommand) (*models.LiveChannelRule, error)
	UpdateChannelRule(cmd models.UpdateLiveChannelRuleCommand) (*models.LiveChannelRule, error)
	DeleteChannelRule(cmd models.DeleteLiveChannelRuleCommand) error
}

type channelRuleAPI struct {
	storage ChannelRuleStorage
}

func (a *channelRuleAPI) ListChannelRules(c *models.ReqContext) response.Response {
	query := models.ListLiveChannelRuleCommand{OrgId: c.OrgId}

	result, err := a.storage.ListChannelRules(query)
	if err != nil {
		return response.Error(500, "Failed to query channel rules", err)
	}

	items := make([]dtos.LiveChannelRuleListItem, 0, len(result))

	for _, ch := range result {
		item := dtos.LiveChannelRuleListItem{
			Id:      ch.Id,
			OrgId:   ch.OrgId,
			Version: ch.Version,
			Pattern: ch.Pattern,
		}
		items = append(items, item)
	}
	return response.JSON(200, &items)
}

func liveChannelToDTO(ch *models.LiveChannelRule) dtos.LiveChannelRule {
	item := dtos.LiveChannelRule{
		Id:               ch.Id,
		OrgId:            ch.OrgId,
		Version:          ch.Version,
		Pattern:          ch.Pattern,
		Config:           ch.Config,
		SecureJsonFields: map[string]bool{},
	}
	for k, v := range ch.Secure {
		if len(v) > 0 {
			item.SecureJsonFields[k] = true
		}
	}
	return item
}

func (a *channelRuleAPI) GetChannelRuleById(c *models.ReqContext) response.Response {
	query := models.GetLiveChannelRuleCommand{
		Id:    c.ParamsInt64(":id"),
		OrgId: c.OrgId,
	}

	result, err := a.storage.GetChannelRule(query)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return response.Error(404, "Channel rule not found", nil)
		}
		return response.Error(500, "Failed to query channel rule", err)
	}
	item := liveChannelToDTO(result)
	return response.JSON(200, &item)
}

func (a *channelRuleAPI) CreateChannelRule(c *models.ReqContext, cmd models.CreateLiveChannelRuleCommand) response.Response {
	cmd.OrgId = c.OrgId

	result, err := a.storage.CreateChannelRule(cmd)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleExists) {
			return response.Error(409, err.Error(), err)
		}
		return response.Error(500, "Failed to create channel rule", err)
	}

	return response.JSON(200, util.DynMap{
		"message":     "channel rule added",
		"id":          result.Id,
		"channelRule": liveChannelToDTO(result),
	})
}

func (a *channelRuleAPI) fillChannelRuleWithSecureJSONData(cmd *models.UpdateLiveChannelRuleCommand) error {
	if len(cmd.Secure) == 0 {
		return nil
	}

	rule, err := a.storage.GetChannelRule(models.GetLiveChannelRuleCommand{
		OrgId: cmd.Id,
		Id:    cmd.Id,
	})
	if err != nil {
		return err
	}

	secureJSONData := rule.Secure.Decrypt()
	for k, v := range secureJSONData {
		if _, ok := cmd.Secure[k]; !ok {
			cmd.Secure[k] = v
		}
	}

	return nil
}

func (a *channelRuleAPI) UpdateChannelRule(c *models.ReqContext, cmd models.UpdateLiveChannelRuleCommand) response.Response {
	cmd.Id = c.ParamsInt64(":id")

	err := a.fillChannelRuleWithSecureJSONData(&cmd)
	if err != nil {
		return response.Error(500, "Failed to update channel rule", err)
	}

	_, err = a.storage.UpdateChannelRule(cmd)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return response.Error(404, "Channel rule not found", nil)
		}
		if errors.Is(err, models.ErrLiveChannelRuleUpdatingOldVersion) {
			return response.Error(409, "Channel rule has already been updated by someone else. Please reload and try again", err)
		}
		return response.Error(500, "Failed to update channel rule", err)
	}

	getCmd := models.GetLiveChannelRuleCommand{
		Id:    cmd.Id,
		OrgId: c.OrgId,
	}

	result, err := a.storage.GetChannelRule(getCmd)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return response.Error(404, "Channel rule not found", nil)
		}
		return response.Error(500, "Failed to query channel rule", err)
	}

	return response.JSON(200, util.DynMap{
		"message":     "channel rule updated",
		"id":          cmd.Id,
		"channelRule": liveChannelToDTO(result),
	})
}

func (a *channelRuleAPI) DeleteChannelRuleById(c *models.ReqContext) response.Response {
	id := c.ParamsInt64(":id")

	if id <= 0 {
		return response.Error(400, "Missing valid channel rule id", nil)
	}

	getCmd := models.GetLiveChannelRuleCommand{
		Id:    id,
		OrgId: c.OrgId,
	}
	_, err := a.storage.GetChannelRule(getCmd)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return response.Error(404, "Channel rule not found", nil)
		}
		return response.Error(500, "Failed to query channel rule", err)
	}

	cmd := models.DeleteLiveChannelRuleCommand{Id: id, OrgId: c.OrgId}
	err = a.storage.DeleteChannelRule(cmd)
	if err != nil {
		return response.Error(500, "Failed to delete channel rule", err)
	}
	return response.Success("Channel rule deleted")
}
