package setting

type TrinoSettings struct {
	LogsArchiveTable string `json:"logsArchiveTable"`
	DatasourceUID    string `json:"datasourceUid"`
}

func (cfg *Cfg) readTrinoSettings() {
	trinoSection := cfg.Raw.Section("trino")
	cfg.Trino = TrinoSettings{
		LogsArchiveTable: trinoSection.Key("logs_archive_table").MustString(""),
		DatasourceUID:    trinoSection.Key("datasource_uid").MustString(""),
	}
}
