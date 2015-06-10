package migrations

import (
	"github.com/go-xorm/xorm"
	m "github.com/grafana/grafana/pkg/models"
	. "github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func addMonitorMigration(mg *Migrator) {

	// monitor v3
	var monitorV3 = Table{
		Name: "monitor",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "endpoint_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "namespace", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "monitor_type_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "offset", Type: DB_BigInt, Nullable: false},
			&Column{Name: "frequency", Type: DB_BigInt, Nullable: false},
			&Column{Name: "enabled", Type: DB_Bool, Nullable: false},
			&Column{Name: "settings", Type: DB_NVarchar, Length: 2048, Nullable: false},
			&Column{Name: "state", Type: DB_BigInt, Nullable: false},
			&Column{Name: "state_change", Type: DB_DateTime, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		}, Indices: []*Index{
			&Index{Cols: []string{"monitor_type_id"}},
			&Index{Cols: []string{"org_id", "namespace", "monitor_type_id"}, Type: UniqueIndex},
		},
	}

	// recreate table
	mg.AddMigration("create monitor v3", NewAddTableMigration(monitorV3))
	// recreate indices
	addTableIndicesMigrations(mg, "v3", monitorV3)

	//-------  drop indexes ------------------
	addDropAllIndicesMigrations(mg, "v3", monitorV3)

	//------- rename table ------------------
	addTableRenameMigration(mg, "monitor", "monitor_v3", "v3")

	var monitorV4 = Table{
		Name: "monitor",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "endpoint_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "org_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "monitor_type_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "offset", Type: DB_BigInt, Nullable: false},
			&Column{Name: "frequency", Type: DB_BigInt, Nullable: false},
			&Column{Name: "enabled", Type: DB_Bool, Nullable: false},
			&Column{Name: "settings", Type: DB_NVarchar, Length: 2048, Nullable: false},
			&Column{Name: "state", Type: DB_BigInt, Nullable: false},
			&Column{Name: "state_change", Type: DB_DateTime, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		}, Indices: []*Index{
			&Index{Cols: []string{"monitor_type_id"}},
			&Index{Cols: []string{"org_id", "endpoint_id", "monitor_type_id"}, Type: UniqueIndex},
		},
	}

	// recreate table
	mg.AddMigration("create monitor v4", NewAddTableMigration(monitorV4))
	// recreate indices
	addTableIndicesMigrations(mg, "v4", monitorV4)
	//------- copy data from v1 to v2 -------------------
	mg.AddMigration("copy monitor v3 to v4", NewCopyTableDataMigration("monitor", "monitor_v3", map[string]string{
		"id":              "id",
		"endpoint_id":     "endpoint_id",
		"org_id":          "org_id",
		"monitor_type_id": "monitor_type_id",
		"offset":          "offset",
		"frequency":       "frequency",
		"enabled":         "enabled",
		"settings":        "settings",
		"state":           "state",
		"state_change":    "state_change",
		"created":         "created",
		"updated":         "updated",
	}))
	mg.AddMigration("Drop old table monitor_v3", NewDropTableMigration("monitor_v3"))

	//monitorTypes
	var monitorTypeV1 = Table{
		Name: "monitor_type",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "name", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
	}
	mg.AddMigration("create monitor_type table", NewAddTableMigration(monitorTypeV1))
	mg.AddMigration("insert http type into monitor_type table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type values(1,'HTTP',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type values(1,'HTTP',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert https type into monitor_type table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type values(2,'HTTPS',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type values(2,'HTTPS',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert ping type into monitor_type table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type values(3,'Ping',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type values(3,'Ping',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert dns type into monitor_type table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type values(4,'DNS',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type values(4,'DNS',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))

	//monitorTypesSettings
	var monitorTypeSettingV1 = Table{
		Name: "monitor_type_setting",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "monitor_type_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "variable", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "description", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "data_type", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "conditions", Type: DB_NVarchar, Length: 1024, Nullable: false},
			&Column{Name: "default_value", Type: DB_NVarchar, Length: 255, Nullable: false},
			&Column{Name: "required", Type: DB_Bool, Nullable: false},
			&Column{Name: "created", Type: DB_DateTime, Nullable: false},
			&Column{Name: "updated", Type: DB_DateTime, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"monitor_type_id"}},
		},
	}
	mg.AddMigration("create monitor_type_setting table", NewAddTableMigration(monitorTypeSettingV1))

	//-------  indexes ------------------
	mg.AddMigration("add index monitor_type_setting.monitor_type_id", NewAddIndexMigration(monitorTypeSettingV1, monitorTypeSettingV1.Indices[0]))

	//-------  data ------------------
	mg.AddMigration("insert http.host type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,1,'host','Hostname','String','{}','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,1,'host','Hostname','String','{}','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert http.path type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,1,'path','Path','String','{}','/',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,1,'path','Path','String','{}','/',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert http.port type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,1,'port','Port','Number','{}','80',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,1,'port','Port','Number','{}','80',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert http.method type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,1,'method','Method','Enum','{\"values\": [\"GET\", \"POST\",\"PUT\",\"DELETE\", \"HEAD\"]}','GET',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,1,'method','Method','Enum','{\"values\": [\"GET\", \"POST\",\"PUT\",\"DELETE\", \"HEAD\"]}','GET',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert http.headers type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,1,'headers','Headers','Text','{}','Accept-Encoding: gzip\nUser-Agent: raintank collector\n',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,1,'headers','Headers','Text','{}','Accept-Encoding: gzip\nUser-Agent: raintank collector\n',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert http.expectRegex type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,1,'expectRegex','Content Match','String','{}','',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,1,'expectRegex','Content Match','String','{}','',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))

	mg.AddMigration("insert https.host type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,2,'host','Hostname','String','{}','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,2,'host','Hostname','String','{}','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert https.path type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,2,'path','Path','String','{}','/',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,2,'path','Path','String','{}','/',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert https.validateCert type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,2,'validateCert','Validate SSL Certificate','Boolean','{}','true',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,2,'validateCert','Validate SSL Certificate','Boolean','{}','true',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert https.port type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,2,'port','Port','Number','{}','443',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,2,'port','Port','Number','{}','443',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert https.method type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,2,'method','Method','Enum','{\"values\": [\"GET\", \"POST\",\"PUT\",\"DELETE\", \"HEAD\"]}','GET',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,2,'method','Method','Enum','{\"values\": [\"GET\", \"POST\",\"PUT\",\"DELETE\", \"HEAD\"]}','GET',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert https.headers type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,2,'headers','Headers','Text','{}','Accept-Encoding: gzip\nUser-Agent: raintank collector\n',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,2,'headers','Headers','Text','{}','Accept-Encoding: gzip\nUser-Agent: raintank collector\n',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert https.expectRegex type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,2,'expectRegex','Content Match','String','{}','',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,2,'expectRegex','Content Match','String','{}','',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))

	mg.AddMigration("insert ping.hostname type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,3,'hostname','Hostname','String','{}','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,3,'hostname','Hostname','String','{}','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))

	mg.AddMigration("insert dns.name type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,4,'name','Record Name','String','{}','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,4,'name','Record Name','String','{}','',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert dns.type type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,4,'type','Record Tyoe','Enum','{\"values\": [\"A\",\"AAAA\",\"CNAME\",\"MX\",\"NS\",\"PTR\",\"SOA\",\"SRV\",\"TXT\"]}','A',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,4,'type','Record Type','Enum','{\"values\": [\"A\",\"AAAA\",\"CNAME\",\"MX\",\"NS\",\"PTR\",\"SOA\",\"SRV\",\"TXT\"]}','A',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert dns.server type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,4,'server','Server','String','{}','8.8.8.8',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,4,'server','Server','String','{}','8.8.8.8',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert dns.port type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,4,'port','port','Number','{}','53',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,4,'port','Port','Number','{}','53',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
	mg.AddMigration("insert dns.protocol type_settings into monitor_type_setting table", new(RawSqlMigration).
		Sqlite("INSERT INTO monitor_type_setting values(null,4,'protocol','Protocol','Enum','{\"values\": [\"tcp\",\"udp\"]}','udp',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)").
		Mysql("INSERT INTO monitor_type_setting values(null,4,'protocol','Protocol','Enum','{\"values\": [\"tcp\",\"udp\"]}','udp',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))

	//monitorCollector
	var monitorCollectorV1 = Table{
		Name: "monitor_collector",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "monitor_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "collector_id", Type: DB_BigInt, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"monitor_id", "collector_id"}},
		},
	}
	mg.AddMigration("create monitor_collector table", NewAddTableMigration(monitorCollectorV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", monitorCollectorV1)

	// add monitor_collector_tags
	var monitorCollectorTagV1 = Table{
		Name: "monitor_collector_tag",
		Columns: []*Column{
			&Column{Name: "id", Type: DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			&Column{Name: "monitor_id", Type: DB_BigInt, Nullable: false},
			&Column{Name: "tag", Type: DB_NVarchar, Length: 255, Nullable: false},
		},
		Indices: []*Index{
			&Index{Cols: []string{"monitor_id"}},
			&Index{Cols: []string{"monitor_id", "tag"}, Type: UniqueIndex},
		},
	}
	mg.AddMigration("create monitor_collector_tag table v1", NewAddTableMigration(monitorCollectorTagV1))

	//-------  indexes ------------------
	addTableIndicesMigrations(mg, "v1", monitorCollectorTagV1)

	// add health settings
	migration := NewAddColumnMigration(monitorV3, &Column{
		Name: "health_settings", Type: DB_NVarchar, Length: 2048, Nullable: true, Default: "",
	})
	migration.OnSuccess = func(sess *xorm.Session) error {
		sess.Table("monitor")
		monitors := make([]m.Monitor, 0)
		if err := sess.Find(&monitors); err != nil {
			return err
		}
		for _, mon := range monitors {

			if (mon.HealthSettings != nil) && (mon.HealthSettings.Steps != 0) && (mon.HealthSettings.NumCollectors != 0) {
				continue
			}
			if mon.HealthSettings == nil {
				mon.HealthSettings = &m.MonitorHealthSettingDTO{NumCollectors: 1, Steps: 2}
			} else {
				mon.HealthSettings.NumCollectors = 1
				mon.HealthSettings.Steps = 2
			}
			if _, err := sess.Id(mon.Id).Update(mon); err != nil {
				return err
			}
		}
		return nil
	}
	mg.AddMigration("monitor add alerts v1", migration)
}
