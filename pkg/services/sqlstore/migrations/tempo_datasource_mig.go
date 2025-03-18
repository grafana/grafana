package migrations

import (
	"encoding/json"

	"xorm.io/xorm"

	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func enableTraceQLStreaming(mg *Migrator, enable bool) {
	mg.AddMigration("Enable traceQL streaming for all Tempo datasources", &AddTraceQLStreamingToJsonData{Enable: enable})
}

var _ CodeMigration = new(AddTraceQLStreamingToJsonData)

type AddTraceQLStreamingToJsonData struct {
	MigrationBase
	Enable bool
}

func (m *AddTraceQLStreamingToJsonData) SQL(dialect Dialect) string {
	return "code migration"
}

type TempoIdJsonDataDTO struct {
	Id       int64
	JsonData string
}

func (m *AddTraceQLStreamingToJsonData) Exec(sess *xorm.Session, mg *Migrator) error {
	datasources := make([]*TempoIdJsonDataDTO, 0)

	// Skip update if the feature flag is not enabled but mark the migration as completed
	if !m.Enable {
		return nil
	}

	err := sess.SQL("SELECT id, json_data FROM data_source WHERE type = 'tempo'").Find(&datasources)

	if err != nil {
		return err
	}

	enabledStreamingMap := map[string]interface{}{
		"search": true,
	}

	for _, ds := range datasources {
		var parsedMap map[string]interface{}
		if err := json.Unmarshal([]byte(ds.JsonData), &parsedMap); err != nil {
			continue
		}
		// skip datasource if streamingEnabled is already set
		if parsedMap["streamingEnabled"] != nil {
			continue
		}
		parsedMap["streamingEnabled"] = enabledStreamingMap

		newJsonData, err := json.Marshal(parsedMap)
		if err != nil {
			return err
		}

		_, err = sess.Exec("UPDATE data_source SET json_data = ? WHERE id = ?", newJsonData, ds.Id)
		if err != nil {
			return err
		}
	}

	return err
}
