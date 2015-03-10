package sqlstore

import (
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
)

func init() {
	bus.AddHandler("sql", GetMonitors)
	bus.AddHandler("sql", GetMonitorById)
	bus.AddHandler("sql", GetMonitorTypes)
	bus.AddHandler("sql", AddMonitor)
	bus.AddHandler("sql", UpdateMonitor)
	bus.AddHandler("sql", DeleteMonitor)
}

type MonitorWithLocationDTO struct {
	Id            int64
	EndpointId    int64
	OrgId         int64
	Namespace     string
	MonitorTypeId int64
	LocationIds   string
	LocationTags  string
	Settings      []*m.MonitorSettingDTO
	Frequency     int64
	Enabled       bool
	Offset        int64
	Updated       time.Time
	Created       time.Time
}

func GetMonitorById(query *m.GetMonitorByIdQuery) error {
	sess := x.Table("monitor")
	rawParams := make([]interface{}, 0)
	rawSql := `SELECT
	 	GROUP_CONCAT(monitor_location.location_id) as location_ids,
		GROUP_CONCAT(monitor_location_tag.tag) as location_tags,
		monitor.*
	FROM monitor
	LEFT JOIN monitor_location ON monitor.id = monitor_location.monitor_id
	LEFT JOIN monitor_location_tag ON monitor.id = monitor_location_tag.monitor_id
	WHERE monitor.id=?
	`
	rawParams = append(rawParams, query.Id)
	
	if query.IsRaintankAdmin != true {
		rawSql += "AND monitor.org_id=?\n"
		rawParams = append(rawParams, query.OrgId)
	}
	rawSql += "GROUP BY monitor.id"

	//store the results into an array of maps.
	results := make([]*MonitorWithLocationDTO, 0)
	err := sess.Sql(rawSql, rawParams...).Find(&results)
	if err != nil {
		log.Info("error getting results.")
		fmt.Print(err)
		return err
	}
	result := results[0]

	monitorLocations := make([]int64, 0)
	for _, l := range strings.Split(result.LocationIds, ",") {
		i, err := strconv.ParseInt(l, 10, 64)
		if err != nil {
			return err
		}
		monitorLocations = append(monitorLocations, i)
	}

	monitorLocationTags := make([]string, 0)
	if result.LocationTags != "" {
		monitorLocationTags = strings.Split(result.LocationTags, ",")
	}

	query.Result = &m.MonitorDTO{
		Id:            result.Id,
		EndpointId:    result.EndpointId,
		OrgId:         result.OrgId,
		Namespace:     result.Namespace,
		MonitorTypeId: result.MonitorTypeId,
		LocationIds:   monitorLocations,
		LocationTags:  monitorLocationTags,
		Settings:      result.Settings,
		Frequency:     result.Frequency,
		Enabled:       result.Enabled,
		Offset:        result.Offset,
		Updated:       result.Updated,
	}

	return nil
}

func GetMonitors(query *m.GetMonitorsQuery) error {
	sess := x.Table("monitor")
	rawParams := make([]interface{}, 0)
	rawSql := `SELECT
	 	GROUP_CONCAT(monitor_location.location_id) as location_ids,
		GROUP_CONCAT(monitor_location_tag.tag) as location_tags,
		monitor.*
	FROM monitor
	LEFT JOIN monitor_location ON monitor.id = monitor_location.monitor_id
	LEFT JOIN monitor_location_tag ON monitor.id = monitor_location_tag.monitor_id
	`

	whereSql := make([]string, 0)
	if query.IsRaintankAdmin != true {
		whereSql = append(whereSql, "monitor.org_id=?")
		rawParams = append(rawParams, query.OrgId)
	}

	if len(query.EndpointId) > 0 {
		if len(query.EndpointId) > 1 {
			whereSql = append(whereSql, "monitor.id IN (?)")
			endpointStr := make([]string, len(query.EndpointId))
			for _, id := range query.EndpointId {
				endpointStr = append(endpointStr, strconv.FormatInt(id, 10))
			}
			rawParams = append(rawParams, strings.Join(endpointStr, ","))
		} else {
			whereSql = append(whereSql, "monitor.id=?")
			rawParams = append(rawParams, query.EndpointId[0])
		}
	}

	if query.Modulo > 0 {
		whereSql = append(whereSql, "(monitor.id % ?) = ?")
		rawParams = append(rawParams, query.Modulo, query.ModuloOffset)
	}

	rawSql += "WHERE " + strings.Join(whereSql, " AND ")
	rawSql += " GROUP BY monitor.id"

	result := make([]*MonitorWithLocationDTO, 0)
	err := sess.Sql(rawSql, rawParams...).Find(&result)
	if err != nil {
		log.Info("error getting results.")
		fmt.Print(err)
		return err
	}

	monitors := make([]*m.MonitorDTO, 0)
	//iterate through all of the results and build out our checks model.
	for _, row := range result {
		monitorLocations := make([]int64, 0)
		for _, l := range strings.Split(row.LocationIds, ",") {
			if l != "" {
				i, err := strconv.ParseInt(l, 10, 64)
				if err != nil {
					return err
				}
				monitorLocations = append(monitorLocations, i)
			}
		}
		monitorLocationTags := make([]string, 0)
		if row.LocationTags != "" {
			monitorLocationTags = strings.Split(row.LocationTags, ",")
		}

		monitors = append(monitors, &m.MonitorDTO{
			Id:            row.Id,
			EndpointId:    row.EndpointId,
			OrgId:         row.OrgId,
			Namespace:     row.Namespace,
			MonitorTypeId: row.MonitorTypeId,
			LocationIds:   monitorLocations,
			LocationTags:  monitorLocationTags,
			Settings:      row.Settings,
			Frequency:     row.Frequency,
			Enabled:       row.Enabled,
			Offset:        row.Offset,
			Updated:       row.Updated,
		})
	}
	query.Result = monitors

	return nil

}

type MonitorTypeWithSettingsDTO struct {
	Id           int64
	Name         string
	Variable     string
	Description  string
	Required     bool
	DataType     string
	Conditions   map[string]interface{}
	DefaultValue string
}

func GetMonitorTypes(query *m.GetMonitorTypesQuery) error {
	sess := x.Table("monitor_type")
	sess.Limit(100, 0).Asc("name")
	sess.Join("LEFT", "monitor_type_setting", "monitor_type_setting.monitor_type_id=monitor_type.id")
	sess.Cols("monitor_type.id", "monitor_type.name",
		"monitor_type_setting.variable", "monitor_type_setting.description",
		"monitor_type_setting.required", "monitor_type_setting.data_type",
		"monitor_type_setting.conditions", "monitor_type_setting.default_value")

	result := make([]*MonitorTypeWithSettingsDTO, 0)
	err := sess.Find(&result)
	if err != nil {
		log.Info("error getting results.")
		fmt.Print(err)
		return err
	}
	types := make(map[int64]*m.MonitorTypeDTO)
	//iterate through all of the results and build out our checks model.
	for _, row := range result {
		if _, ok := types[row.Id]; ok != true {
			//this is the first time we have seen this monitorId
			var typeSettings []*m.MonitorTypeSettingDTO
			types[row.Id] = &m.MonitorTypeDTO{
				Id:       row.Id,
				Name:     row.Name,
				Settings: typeSettings,
			}
		}

		types[row.Id].Settings = append(types[row.Id].Settings, &m.MonitorTypeSettingDTO{
			Variable:     row.Variable,
			Description:  row.Description,
			Required:     row.Required,
			DataType:     row.DataType,
			Conditions:   row.Conditions,
			DefaultValue: row.DefaultValue,
		})
	}

	query.Result = make([]*m.MonitorTypeDTO, len(types))
	count := 0
	for _, v := range types {
		query.Result[count] = v
		count++
	}

	return nil
}

func DeleteMonitor(cmd *m.DeleteMonitorCommand) error {
	return inTransaction2(func(sess *session) error {
		q := m.GetMonitorByIdQuery{
			Id:    cmd.Id,
			OrgId: cmd.OrgId,
		}
		err := GetMonitorById(&q)
		if err != nil {
			return err
		}

		endpointQuery := m.GetEndpointByIdQuery{
			Id:    q.Result.EndpointId,
			OrgId: cmd.OrgId,
		}
		err = GetEndpointById(&endpointQuery)
		if err != nil {
			return err
		}
		var rawSql = "DELETE FROM monitor WHERE id=? and org_id=?"
		_, err = sess.Exec(rawSql, cmd.Id, cmd.OrgId)
		if err != nil {
			return err
		}
		rawSql = "DELETE FROM monitor_location WHERE monitor_id=?"
		_, err = sess.Exec(rawSql, cmd.Id)
		if err != nil {
			return err
		}
		rawSql = "DELETE FROM monitor_location_tag WHERE monitor_id=?"
		_, err = sess.Exec(rawSql, cmd.Id)
		if err != nil {
			return err
		}

		sess.publishAfterCommit(&events.MonitorRemoved{
			Timestamp: time.Now(),
			Id:        q.Result.Id,
			Endpoint: events.EndpointPayload{
				Id:    endpointQuery.Result.Id,
				OrgId: endpointQuery.Result.OrgId,
				Name:  endpointQuery.Result.Name,
			},
			OrgId:        q.Result.OrgId,
			LocationIds:  q.Result.LocationIds,
			LocationTags: q.Result.LocationTags,
		})
		return nil
	})
}

// store location list query result
type locationList struct {
	Id int64
}

func AddMonitor(cmd *m.AddMonitorCommand) error {

	return inTransaction2(func(sess *session) error {
		//validate Endpoint.
		endpointQuery := m.GetEndpointByIdQuery{
			Id:    cmd.EndpointId,
			OrgId: cmd.OrgId,
		}
		err := GetEndpointById(&endpointQuery)
		if err != nil {
			return err
		}

		filtered_locations := make([]*locationList, 0, len(cmd.LocationIds))
		sess.Table("location")
		sess.In("id", cmd.LocationIds).Where("org_id=? or public=1", cmd.OrgId)
		sess.Cols("id")
		err = sess.Find(&filtered_locations)

		if err != nil {
			return err
		}

		if len(filtered_locations) < len(cmd.LocationIds) {
			return m.ErrMonitorLocationsInvalid
		}

		//get settings definition for thie monitorType.
		var typeSettings []*m.MonitorTypeSetting
		sess.Table("monitor_type_setting")
		sess.Where("monitor_type_id=?", cmd.MonitorTypeId)
		err = sess.Find(&typeSettings)
		if err != nil {
			return nil
		}

		// push the typeSettings into a Map with the variable name as key
		settingMap := make(map[string]*m.MonitorTypeSetting)
		for _, s := range typeSettings {
			settingMap[s.Variable] = s
		}

		//validate the settings.
		seenMetrics := make(map[string]bool)
		for _, v := range cmd.Settings {
			def, ok := settingMap[v.Variable]
			if ok != true {
				log.Info("Unkown variable %s passed.", v.Variable)
				return m.ErrMonitorSettingsInvalid
			}
			//TODO:(awoods) make sure the value meets the definition.
			seenMetrics[def.Variable] = true
			log.Info("%s present in settings", def.Variable)
		}

		//make sure all required variables were provided.
		//add defaults for missing optional variables.
		for k, s := range settingMap {
			if _, ok := seenMetrics[k]; ok != true {
				log.Info("%s not in settings", k)
				if s.Required {
					// required setting variable missing.
					return m.ErrMonitorSettingsInvalid
				}
				cmd.Settings = append(cmd.Settings, &m.MonitorSettingDTO{
					Variable: k,
					Value:    s.DefaultValue,
				})
			}
		}

		if cmd.Namespace == "" {
			cmd.Namespace = fmt.Sprintf("network.%s", endpointQuery.Result.Name)
		}

		mon := &m.Monitor{
			EndpointId:    cmd.EndpointId,
			OrgId:         cmd.OrgId,
			Namespace:     cmd.Namespace,
			MonitorTypeId: cmd.MonitorTypeId,
			Offset:        rand.Int63n(cmd.Frequency - 1),
			Settings:      cmd.Settings,
			Created:       time.Now(),
			Updated:       time.Now(),
			Frequency:     cmd.Frequency,
			Enabled:       cmd.Enabled,
		}

		if _, err := sess.Insert(mon); err != nil {
			return err
		}
		monitor_locations := make([]*m.MonitorLocation, 0, len(cmd.LocationIds))
		for _, l := range cmd.LocationIds {
			monitor_locations = append(monitor_locations, &m.MonitorLocation{
				MonitorId:  mon.Id,
				LocationId: l,
			})
		}
		if len(monitor_locations) == 0 {
			err = fmt.Errorf("No monitor locations chosen")
			return err
		}
		sess.Table("monitor_location")
		if _, err = sess.Insert(&monitor_locations); err != nil {
			return err
		}
		cmd.Result = &m.MonitorDTO{
			Id:            mon.Id,
			EndpointId:    mon.EndpointId,
			OrgId:         mon.OrgId,
			Namespace:     mon.Namespace,
			MonitorTypeId: mon.MonitorTypeId,
			LocationIds:   cmd.LocationIds,
			Settings:      mon.Settings,
			Frequency:     mon.Frequency,
			Enabled:       mon.Enabled,
			Offset:        mon.Offset,
			Updated:       mon.Updated,
		}
		sess.publishAfterCommit(&events.MonitorCreated{
			Timestamp: mon.Updated,
			MonitorPayload: events.MonitorPayload{
				Id: mon.Id,
				Endpoint: events.EndpointPayload{
					Id:    endpointQuery.Result.Id,
					OrgId: endpointQuery.Result.OrgId,
					Name:  endpointQuery.Result.Name,
				},
				OrgId:         mon.OrgId,
				Namespace:     mon.Namespace,
				MonitorTypeId: mon.MonitorTypeId,
				LocationIds:   cmd.LocationIds,
				Settings:      mon.Settings,
				Frequency:     mon.Frequency,
				Enabled:       mon.Enabled,
				Offset:        mon.Offset,
				Updated:       mon.Updated,
			},
		})
		return nil
	})
}

func UpdateMonitor(cmd *m.UpdateMonitorCommand) error {
	return inTransaction2(func(sess *session) error {
		//validate Endpoint.
		endpointQuery := m.GetEndpointByIdQuery{
			Id:    cmd.EndpointId,
			OrgId: cmd.OrgId,
		}
		err := GetEndpointById(&endpointQuery)
		if err != nil {
			return err
		}
		currentEndpoint := endpointQuery.Result

		q := m.GetMonitorByIdQuery{
			Id:    cmd.Id,
			OrgId: cmd.OrgId,
		}
		err = GetMonitorById(&q)
		if err != nil {
			return err
		}
		lastState := q.Result

		if lastState.EndpointId != cmd.EndpointId {
			return m.ErrorEndpointCantBeChanged
		}

		//validate locations.
		filtered_locations := make([]*locationList, 0, len(cmd.LocationIds))
		sess.Table("location")
		sess.In("id", cmd.LocationIds).Where("org_id=? or public=1", cmd.OrgId)
		sess.Cols("id")
		err = sess.Find(&filtered_locations)

		if err != nil {
			return err
		}

		if len(filtered_locations) < len(cmd.LocationIds) {
			return m.ErrMonitorLocationsInvalid
		}

		//get settings definition for thie monitorType.
		var typeSettings []*m.MonitorTypeSetting
		sess.Table("monitor_type_setting")
		sess.Where("monitor_type_id=?", cmd.MonitorTypeId)
		err = sess.Find(&typeSettings)
		if err != nil {
			return nil
		}
		if len(typeSettings) < 1 {
			log.Info("no monitorType settings found for type: %d", cmd.MonitorTypeId)
			return m.ErrMonitorSettingsInvalid
		}
		// push the typeSettings into a Map with the variable name as key
		settingMap := make(map[string]*m.MonitorTypeSetting)
		for _, s := range typeSettings {
			settingMap[s.Variable] = s
		}

		//validate the settings.
		seenMetrics := make(map[string]bool)
		for _, v := range cmd.Settings {
			def, ok := settingMap[v.Variable]
			if ok != true {
				log.Info("Unkown variable %s passed.", v.Variable)
				return m.ErrMonitorSettingsInvalid
			}
			//TODO:(awoods) make sure the value meets the definition.
			seenMetrics[def.Variable] = true
		}

		//make sure all required variables were provided.
		//add defaults for missing optional variables.
		for k, s := range settingMap {
			if _, ok := seenMetrics[k]; ok != true {
				log.Info("%s not in settings", k)
				if s.Required {
					// required setting variable missing.
					return m.ErrMonitorSettingsInvalid
				}
				cmd.Settings = append(cmd.Settings, &m.MonitorSettingDTO{
					Variable: k,
					Value:    s.DefaultValue,
				})
			}
		}

		if cmd.Namespace == "" {
			cmd.Namespace = fmt.Sprintf("network.%s", currentEndpoint.Name)
		}

		mon := &m.Monitor{
			Id:            cmd.Id,
			EndpointId:    cmd.EndpointId,
			OrgId:         cmd.OrgId,
			Namespace:     cmd.Namespace,
			MonitorTypeId: cmd.MonitorTypeId,
			Settings:      cmd.Settings,
			Updated:       time.Now(),
			Enabled:       cmd.Enabled,
			Frequency:     cmd.Frequency,
		}

		//check if we need to update the time offset for when the monitor should run.
		if mon.Offset >= mon.Frequency {
			mon.Offset = rand.Int63n(mon.Frequency - 1)
		}

		sess.UseBool("enabled")
		if _, err = sess.Where("id=? and org_id=?", mon.Id, mon.OrgId).Update(mon); err != nil {
			return err
		}

		var rawSql = "DELETE FROM monitor_location WHERE monitor_id=?"
		if _, err := sess.Exec(rawSql, cmd.Id); err != nil {
			return err
		}
		monitor_locations := make([]*m.MonitorLocation, 0, len(cmd.LocationIds))
		for _, l := range cmd.LocationIds {
			monitor_locations = append(monitor_locations, &m.MonitorLocation{
				MonitorId:  cmd.Id,
				LocationId: l,
			})
		}
		sess.Table("monitor_location")
		_, err = sess.Insert(&monitor_locations)

		sess.publishAfterCommit(&events.MonitorUpdated{
			MonitorPayload: events.MonitorPayload{
				Id: mon.Id,
				Endpoint: events.EndpointPayload{
					Id:    currentEndpoint.Id,
					OrgId: currentEndpoint.OrgId,
					Name:  currentEndpoint.Name,
				},
				OrgId:         mon.OrgId,
				Namespace:     mon.Namespace,
				MonitorTypeId: mon.MonitorTypeId,
				LocationIds:   cmd.LocationIds,
				Settings:      mon.Settings,
				Frequency:     mon.Frequency,
				Enabled:       mon.Enabled,
				Offset:        mon.Offset,
				Updated:       mon.Updated,
			},
			Timestamp: mon.Updated,
			LastState: &events.MonitorPayload{
				Id: lastState.Id,
				Endpoint: events.EndpointPayload{
					Id:    currentEndpoint.Id,
					OrgId: currentEndpoint.OrgId,
					Name:  currentEndpoint.Name,
				},
				OrgId:         lastState.OrgId,
				Namespace:     lastState.Namespace,
				MonitorTypeId: lastState.MonitorTypeId,
				LocationIds:   lastState.LocationIds,
				LocationTags:  lastState.LocationTags,
				Settings:      lastState.Settings,
				Frequency:     lastState.Frequency,
				Enabled:       lastState.Enabled,
				Offset:        lastState.Offset,
				Updated:       lastState.Updated,
			},
		})

		return err
	})
}
