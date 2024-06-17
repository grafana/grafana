// TODO: Move these to a shared library in common with GMS
package gmsclient

type MigrateDataType string

const (
	DashboardDataType  MigrateDataType = "DASHBOARD"
	DatasourceDataType MigrateDataType = "DATASOURCE"
	FolderDataType     MigrateDataType = "FOLDER"
)

type MigrateDataRequestDTO struct {
	Items []MigrateDataRequestItemDTO `json:"items"`
}

type MigrateDataRequestItemDTO struct {
	Type  MigrateDataType `json:"type"`
	RefID string          `json:"refId"`
	Name  string          `json:"name"`
	Data  interface{}     `json:"data"`
}

type ItemStatus string

const (
	ItemStatusOK    ItemStatus = "OK"
	ItemStatusError ItemStatus = "ERROR"
)

type MigrateDataResponseDTO struct {
	RunUID string                       `json:"uid"`
	Items  []MigrateDataResponseItemDTO `json:"items"`
}

type MigrateDataResponseListDTO struct {
	RunUID string `json:"uid"`
}

type MigrateDataResponseItemDTO struct {
	// required:true
	Type MigrateDataType `json:"type"`
	// required:true
	RefID string `json:"refId"`
	// required:true
	Status ItemStatus `json:"status"`
	Error  string     `json:"error,omitempty"`
}
