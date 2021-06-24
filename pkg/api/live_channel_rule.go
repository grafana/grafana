package api

import (
	"errors"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

func (hs *HTTPServer) ListChannelRules(c *models.ReqContext) response.Response {
	query := models.ListLiveChannelRuleCommand{OrgId: c.OrgId}

	result, err := hs.Live.ChannelRuleStorage().ListChannelRules(query)
	if err != nil {
		return response.Error(500, "Failed to query channel rules", err)
	}

	items := make([]dtos.LiveChannelListItem, 0, len(result))

	for _, ch := range result {
		item := dtos.LiveChannelListItem{
			Id:      ch.Id,
			OrgId:   ch.OrgId,
			Version: ch.Version,
			Pattern: ch.Pattern,
		}
		items = append(items, item)
	}
	return response.JSON(200, &items)
}

func liveChannelToDTO(ch *models.LiveChannelRule) dtos.LiveChannelConfig {
	item := dtos.LiveChannelConfig{
		Id:      ch.Id,
		OrgId:   ch.OrgId,
		Version: ch.Version,
		Pattern: ch.Pattern,
		Config:  ch.Config,
	}
	return item
}

func (hs *HTTPServer) GetChannelRuleById(c *models.ReqContext) response.Response {
	query := models.GetLiveChannelRuleCommand{
		Id:    c.ParamsInt64(":id"),
		OrgId: c.OrgId,
	}

	result, err := hs.Live.ChannelRuleStorage().GetChannelRule(query)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return response.Error(404, "Channel rule not found", nil)
		}
		return response.Error(500, "Failed to query channel rule", err)
	}
	item := liveChannelToDTO(result)
	return response.JSON(200, &item)
}

func (hs *HTTPServer) CreateChannelRule(c *models.ReqContext, cmd models.CreateLiveChannelRuleCommand) response.Response {
	cmd.OrgId = c.OrgId

	result, err := hs.Live.ChannelRuleStorage().CreateChannelRule(cmd)
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

func (hs *HTTPServer) UpdateChannelRule(c *models.ReqContext, cmd models.UpdateLiveChannelRuleCommand) response.Response {
	cmd.Id = c.ParamsInt64(":id")

	//err := fillWithSecureJSONData(&cmd)
	//if err != nil {
	//	return response.Error(500, "Failed to update channel rule", err)
	//}

	_, err := hs.Live.ChannelRuleStorage().UpdateChannelRule(cmd)
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

	result, err := hs.Live.ChannelRuleStorage().GetChannelRule(getCmd)
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

func (hs *HTTPServer) DeleteChannelRuleById(c *models.ReqContext) response.Response {
	id := c.ParamsInt64(":id")

	if id <= 0 {
		return response.Error(400, "Missing valid channel rule id", nil)
	}

	getCmd := models.GetLiveChannelRuleCommand{
		Id:    id,
		OrgId: c.OrgId,
	}
	_, err := hs.Live.ChannelRuleStorage().GetChannelRule(getCmd)
	if err != nil {
		if errors.Is(err, models.ErrLiveChannelRuleNotFound) {
			return response.Error(404, "Channel rule not found", nil)
		}
		return response.Error(500, "Failed to query channel rule", err)
	}

	cmd := models.DeleteLiveChannelRuleCommand{Id: id, OrgId: c.OrgId}
	err = hs.Live.ChannelRuleStorage().DeleteChannelRule(cmd)
	if err != nil {
		return response.Error(500, "Failed to delete channel rule", err)
	}
	return response.Success("Channel rule deleted")
}
