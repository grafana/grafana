package models

import "time"

// DatasourceSync stores the configuration for syncing a Mimir Alertmanager datasource into Grafana.
type DatasourceSync struct {
	ID            int64     `xorm:"pk autoincr 'id'"`
	OrgID         int64     `xorm:"org_id"`
	DatasourceUID string    `xorm:"datasource_uid"`
	Enabled       bool      `xorm:"enabled"`
	LastSyncAt    time.Time `xorm:"last_sync_at"`
	LastError     string    `xorm:"last_error"`
}

func (DatasourceSync) TableName() string {
	return "ngalert_datasource_sync"
}
