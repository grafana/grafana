package sqlstore

import (
	"fmt"
	"math/rand"
	"strconv"
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
	LocationId    int64
	Settings      []*m.MonitorSettingDTO
	Frequency     int64
	Enabled       bool
	Offset        int64
}

func GetMonitorById(query *m.GetMonitorByIdQuery) error {
	sess := x.Table("monitor")
	sess.Join("LEFT", "monitor_location", "monitor_location.monitor_id=monitor.id")
	sess.Where("monitor.id=?", query.Id)
	if query.IsRaintankAdmin != true {
		sess.And("monitor.org_id=?", query.OrgId)
	}

	sess.Cols("monitor_location.location_id", "monitor.id",
		"monitor.org_id", "monitor.namespace",
		"monitor.monitor_type_id", "monitor.settings",
		"monitor.frequency", "monitor.enabled", "monitor.offset",
		"monitor.endpoint_id")

	//store the results into an array of maps.
	result := make([]*MonitorWithLocationDTO, 0)
	err := sess.Find(&result)
	if err != nil {
		log.Info("error getting results.")
		fmt.Print(err)
		return err
	}
	if len(result) < 1 {
		log.Info("result count is less then 1")
		return m.ErrMonitorNotFound
	}
	var monitorLocations []int64

	query.Result = &m.MonitorDTO{
		Id:            result[0].Id,
		EndpointId:    result[0].EndpointId,
		OrgId:         result[0].OrgId,
		Namespace:     result[0].Namespace,
		MonitorTypeId: result[0].MonitorTypeId,
		Locations:     monitorLocations,
		Settings:      result[0].Settings,
		Frequency:     result[0].Frequency,
		Enabled:       result[0].Enabled,
		Offset:        result[0].Offset,
	}
	//iterate through all of the results and build out our model.
	for _, row := range result {
		query.Result.Locations = append(query.Result.Locations, row.LocationId)
	}

	return nil
}

func GetMonitors(query *m.GetMonitorsQuery) error {
	sess := x.Table("monitor")
	sess.Join("LEFT", "monitor_location", "monitor_location.monitor_id=monitor.id")
	if query.IsRaintankAdmin != true {
		sess.Where("monitor.org_id=?", query.OrgId)
	}
	sess.Cols("monitor_location.location_id", "monitor.id",
		"monitor.org_id", "monitor.namespace", "monitor.settings",
		"monitor.monitor_type_id", "monitor.frequency",
		"monitor.enabled", "monitor.offset", "monitor.endpoint_id")

	if len(query.EndpointId) > 0 {
		if len(query.EndpointId) > 1 {
			sess.In("monitor.endpoint_id", query.EndpointId)
		} else {
			sess.And("monitor.endpoint_id=?", query.EndpointId[0])
		}
	}

	if len(query.LocationId) > 0 {
		// this is a bit complicated because we want to
		// match only monitors that are enabled in the location,
		// but we still need to return all of the locations that
		// the monitor is enabled in.
		sess.Join("LEFT", []string{"monitor_location", "ml"}, "ml.monitor_id = monitor.id")
		if len(query.LocationId) > 1 {
			sess.In("ml.location_id", query.LocationId)
		} else {
			sess.And("ml.location_id=?", query.LocationId[0])
		}
	}
	if len(query.MonitorTypeId) > 0 {
		if len(query.MonitorTypeId) > 1 {
			sess.In("monitor.monitor_type_id", query.MonitorTypeId)
		} else {
			sess.And("monitor.monitor_type_id=?", query.MonitorTypeId[0])
		}
	}
	if len(query.Frequency) > 0 {
		if len(query.Frequency) > 1 {
			sess.In("monitor.frequency", query.Frequency)
		} else {
			sess.And("monitor.frequency=?", query.Frequency[0])
		}
	}
	if len(query.Enabled) > 0 {
		if p, err := strconv.ParseBool(query.Enabled); err == nil {
			sess.And("monitor.enabled=?", p)
		} else {
			return err
		}
	}

	if query.Modulo > 0 {
		sess.And("(monitor.id % ?) = ?", query.Modulo, query.ModuloOffset)
	}

	// Because of the join, we get back set or rows.
	result := make([]*MonitorWithLocationDTO, 0)
	err := sess.Find(&result)
	if err != nil {
		log.Info("error getting results.")
		fmt.Print(err)
		return err
	}

	monitors := make(map[int64]*m.MonitorDTO)
	//iterate through all of the results and build out our checks model.
	for _, row := range result {
		if _, ok := monitors[row.Id]; ok != true {
			//this is the first time we have seen this monitorId
			var monitorLocations []int64
			monitors[row.Id] = &m.MonitorDTO{
				Id:            row.Id,
				EndpointId:    row.EndpointId,
				OrgId:         row.OrgId,
				Namespace:     row.Namespace,
				MonitorTypeId: row.MonitorTypeId,
				Locations:     monitorLocations,
				Settings:      row.Settings,
				Frequency:     row.Frequency,
				Enabled:       row.Enabled,
				Offset:        row.Offset,
			}
		}

		monitors[row.Id].Locations = append(monitors[row.Id].Locations, row.LocationId)
	}

	query.Result = make([]*m.MonitorDTO, len(monitors))
	count := 0
	for _, v := range monitors {
		query.Result[count] = v
		count++
	}

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
		sess.publishAfterCommit(&events.MonitorRemoved{
			Timestamp: time.Now(),
			Id:        q.Result.Id,
			Endpoint: events.EndpointPayload{
				Id:    endpointQuery.Result.Id,
				OrgId: endpointQuery.Result.OrgId,
				Name:  endpointQuery.Result.Name,
			},
			OrgId:     q.Result.OrgId,
			Locations: q.Result.Locations,
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

		filtered_locations := make([]*locationList, 0, len(cmd.Locations))
		sess.Table("location")
		sess.In("id", cmd.Locations).Where("org_id=? or public=1", cmd.OrgId)
		sess.Cols("id")
		err = sess.Find(&filtered_locations)

		if err != nil {
			return err
		}

		if len(filtered_locations) < len(cmd.Locations) {
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
		monitor_locations := make([]*m.MonitorLocation, 0, len(cmd.Locations))
		for _, l := range cmd.Locations {
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
			Locations:     cmd.Locations,
			Settings:      mon.Settings,
			Frequency:     mon.Frequency,
			Enabled:       mon.Enabled,
			Offset:        mon.Offset,
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
				Locations:     cmd.Locations,
				Settings:      mon.Settings,
				Frequency:     mon.Frequency,
				Enabled:       mon.Enabled,
				Offset:        mon.Offset,
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
		filtered_locations := make([]*locationList, 0, len(cmd.Locations))
		sess.Table("location")
		sess.In("id", cmd.Locations).Where("org_id=? or public=1", cmd.OrgId)
		sess.Cols("id")
		err = sess.Find(&filtered_locations)

		if err != nil {
			return err
		}

		if len(filtered_locations) < len(cmd.Locations) {
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
		monitor_locations := make([]*m.MonitorLocation, 0, len(cmd.Locations))
		for _, l := range cmd.Locations {
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
				Locations:     cmd.Locations,
				Settings:      mon.Settings,
				Frequency:     mon.Frequency,
				Enabled:       mon.Enabled,
				Offset:        mon.Offset,
			},
			Timestamp: mon.Updated,
			Updated:   mon.Updated,
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
				Locations:     lastState.Locations,
				Settings:      lastState.Settings,
				Frequency:     lastState.Frequency,
				Enabled:       lastState.Enabled,
				Offset:        lastState.Offset,
			},
		})

		return err
	})
}
