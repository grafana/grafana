package setting

type DataSourceSettings struct {
	DataSourceUrlRoot string
}

func readDataSourceSettings() {
	ds := Cfg.Section("datasource")
  DataSource.DataSourceUrlRoot = ds.Key("datasource_urlroot").String()
}
