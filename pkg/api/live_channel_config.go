package api

import (
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

var channelConfigLogger = log.New("live_channel_config_api")

func (hs *HTTPServer) GetChannelConfigList(c *models.ReqContext) response.Response {
	query := models.ListLiveChannelConfigCommand{OrgId: c.OrgId}

	if err := bus.Dispatch(&query); err != nil {
		return response.Error(500, "Failed to query datasources", err)
	}

	//result := make(dtos.DataSourceList, 0)
	//for _, ds := range query.Result {
	//	dsItem := dtos.DataSourceListItemDTO{
	//		OrgId:     ds.OrgId,
	//		Id:        ds.Id,
	//		UID:       ds.Uid,
	//		Name:      ds.Name,
	//		Url:       ds.Url,
	//		Type:      ds.Type,
	//		TypeName:  ds.Type,
	//		Access:    ds.Access,
	//		Password:  ds.Password,
	//		Database:  ds.Database,
	//		User:      ds.User,
	//		BasicAuth: ds.BasicAuth,
	//		IsDefault: ds.IsDefault,
	//		JsonData:  ds.JsonData,
	//		ReadOnly:  ds.ReadOnly,
	//	}
	//
	//	if plugin := hs.PluginManager.GetDataSource(ds.Type); plugin != nil {
	//		dsItem.TypeLogoUrl = plugin.Info.Logos.Small
	//		dsItem.TypeName = plugin.Name
	//	} else {
	//		dsItem.TypeLogoUrl = "public/img/icn-datasource.svg"
	//	}
	//
	//	result = append(result, dsItem)
	//}
	//
	//sort.Sort(result)

	return response.JSON(200, &result)
}

func GetLiveChannelConfigById(c *models.ReqContext) response.Response {
	query := models.GetLiveChannelConfigCommand{
		Id:    c.ParamsInt64(":id"),
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&query); err != nil {
		//if errors.Is(err, models.ErrDataSourceNotFound) {
		//	return response.Error(404, "Data source not found", nil)
		//}
		//if errors.Is(err, models.ErrDataSourceIdentifierNotSet) {
		//	return response.Error(400, "Datasource id is missing", nil)
		//}
		return response.Error(500, "Failed to query datasources", err)
	}

	ds := query.Result
	//dtos := convertModelToDtos(ds)

	return response.JSON(200, &dtos)
}

func CreateLiveChannelConfig(c *models.ReqContext, cmd models.CreateLiveChannelConfigCommand) response.Response {
	cmd.OrgId = c.OrgId

	if err := bus.Dispatch(&cmd); err != nil {
		//if errors.Is(err, models.ErrDataSourceNameExists) || errors.Is(err, models.ErrDataSourceUidExists) {
		//	return response.Error(409, err.Error(), err)
		//}
		return response.Error(500, "Failed to create channel config", err)
	}

	ds := convertModelToDtos(cmd.Result)
	return response.JSON(200, util.DynMap{
		"message":           "Channel config added",
		"id":                cmd.Result.Id,
		"liveChannelConfig": ds,
	})
}

func (hs *HTTPServer) UpdateLiveChannelConfig(c *models.ReqContext, cmd models.UpdateLiveChannelConfigCommand) response.Response {
	cmd.Id = c.ParamsInt64(":id")

	//err := fillWithSecureJSONData(&cmd)
	//if err != nil {
	//	return response.Error(500, "Failed to update datasource", err)
	//}

	err := bus.Dispatch(&cmd)
	if err != nil {
		//if errors.Is(err, models.ErrDataSourceUpdatingOldVersion) {
		//	return response.Error(409, "Datasource has already been updated by someone else. Please reload and try again", err)
		//}
		return response.Error(500, "Failed to update channel config", err)
	}

	getCmd := models.GetLiveChannelConfigCommand{
		Id:    cmd.Id,
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&getCmd); err != nil {
		//if errors.Is(err, models.ErrDataSourceNotFound) {
		//	return response.Error(404, "Data source not found", nil)
		//}
		return response.Error(500, "Failed to query channel config", err)
	}

	//datasourceDTO := convertModelToDtos(query.Result)

	return response.JSON(200, util.DynMap{
		"message":           "Datasource updated",
		"id":                cmd.Id,
		"liveChannelConfig": datasourceDTO,
	})
}

func (hs *HTTPServer) DeleteLiveChannelConfigById(c *models.ReqContext) response.Response {
	id := c.ParamsInt64(":id")

	if id <= 0 {
		return response.Error(400, "Missing valid channel config id", nil)
	}

	getCmd := models.GetLiveChannelConfigCommand{
		Id:    id,
		OrgId: c.OrgId,
	}

	if err := bus.Dispatch(&getCmd); err != nil {
		//if errors.Is(err, models.ErrDataSourceNotFound) {
		//	return response.Error(404, "Data source not found", nil)
		//}
		return response.Error(500, "Failed to query channel config", err)
	}

	cmd := &models.DeleteLiveChannelConfigCommand{Id: id, OrgId: c.OrgId}

	err := bus.Dispatch(cmd)
	if err != nil {
		return response.Error(500, "Failed to delete channel config", err)
	}

	hs.Live.HandleDatasourceDelete(c.OrgId, ds.Uid)

	return response.Success("Data source deleted")
}
