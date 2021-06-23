package api

import (
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

//var channelConfigLogger = log.New("live_channel_api")

func (hs *HTTPServer) ListChannelRules(c *models.ReqContext) response.Response {
	query := models.ListLiveChannelRulesCommand{OrgId: c.OrgId}

	result, err := hs.Live.ChannelRuleStorage().ListChannelRules(query)
	if err != nil {
		return response.Error(500, "Failed to query channel configs", err)
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

	result, err := hs.Live.ChannelRuleStorage().GetChannelConfig(query)
	if err != nil {
		//if errors.Is(err, models.ErrDataSourceNotFound) {
		//	return response.Error(404, "Data source not found", nil)
		//}
		//if errors.Is(err, models.ErrDataSourceIdentifierNotSet) {
		//	return response.Error(400, "Datasource id is missing", nil)
		//}
		return response.Error(500, "Failed to query datasources", err)
	}
	item := liveChannelToDTO(result)
	return response.JSON(200, &item)
}

func (hs *HTTPServer) CreateChannelRule(c *models.ReqContext, cmd models.CreateLiveChannelRuleCommand) response.Response {
	cmd.OrgId = c.OrgId

	result, err := hs.Live.ChannelRuleStorage().CreateChannelRule(cmd)
	if err != nil {
		//if errors.Is(err, models.ErrDataSourceNameExists) || errors.Is(err, models.ErrDataSourceUidExists) {
		//	return response.Error(409, err.Error(), err)
		//}
		return response.Error(500, "Failed to create channel config", err)
	}

	return response.JSON(200, util.DynMap{
		"message":           "Pattern config added",
		"id":                result.Id,
		"liveChannelConfig": liveChannelToDTO(result),
	})
}

func (hs *HTTPServer) UpdateChannelRule(c *models.ReqContext, cmd models.UpdateLiveChannelRuleCommand) response.Response {
	cmd.Id = c.ParamsInt64(":id")

	//err := fillWithSecureJSONData(&cmd)
	//if err != nil {
	//	return response.Error(500, "Failed to update datasource", err)
	//}

	_, err := hs.Live.ChannelRuleStorage().UpdateChannelConfig(cmd)
	if err != nil {
		//if errors.Is(err, models.ErrDataSourceUpdatingOldVersion) {
		//	return response.Error(409, "Datasource has already been updated by someone else. Please reload and try again", err)
		//}
		return response.Error(500, "Failed to update channel config", err)
	}

	getCmd := models.GetLiveChannelRuleCommand{
		Id:    cmd.Id,
		OrgId: c.OrgId,
	}

	result, err := hs.Live.ChannelRuleStorage().GetChannelConfig(getCmd)
	if err != nil {
		//if errors.Is(err, models.ErrDataSourceNotFound) {
		//	return response.Error(404, "Data source not found", nil)
		//}
		return response.Error(500, "Failed to query channel config", err)
	}

	//datasourceDTO := convertModelToDtos(query.Result)

	return response.JSON(200, util.DynMap{
		"message":           "Pattern config updated",
		"id":                cmd.Id,
		"liveChannelConfig": liveChannelToDTO(result),
	})
}

func (hs *HTTPServer) DeleteChannelRuleById(c *models.ReqContext) response.Response {
	id := c.ParamsInt64(":id")

	if id <= 0 {
		return response.Error(400, "Missing valid channel config id", nil)
	}

	getCmd := models.GetLiveChannelRuleCommand{
		Id:    id,
		OrgId: c.OrgId,
	}
	_, err := hs.Live.ChannelRuleStorage().GetChannelConfig(getCmd)
	if err != nil {
		//if errors.Is(err, models.ErrDataSourceNotFound) {
		//	return response.Error(404, "Data source not found", nil)
		//}
		return response.Error(500, "Failed to query channel config", err)
	}

	cmd := models.DeleteLiveChannelRuleCommand{Id: id, OrgId: c.OrgId}
	err = hs.Live.ChannelRuleStorage().DeleteChannelConfig(cmd)
	if err != nil {
		return response.Error(500, "Failed to delete channel config", err)
	}
	return response.Success("Pattern config deleted")
}
