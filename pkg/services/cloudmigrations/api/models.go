package api

type migrateDatasourcesRequestDTO struct {
	MigrateToPDC       bool `json:"migrateToPDC"`
	MigrateCredentials bool `json:"migrateCredentials"`
}

type migrateDatasourcesResponseDTO struct {
	DatasourcesMigrated int `json:"datasourcesMigrated"`
}
