package filestorage

type BackendType string

const (
	BackendTypeFS BackendType = "fs"
	BackendTypeDB BackendType = "db"
)

type fsBackendConfig struct {
	RootPath string `json:"path"`
}

type backendConfig struct {
	Type                BackendType `json:"type"`
	Name                string      `json:"name"`
	AllowedPrefixes     []string    `json:"allowedPrefixes"`     // null -> all paths are allowed
	SupportedOperations []Operation `json:"supportedOperations"` // null -> all operations are supported

	FSBackendConfig *fsBackendConfig `json:"fsBackendConfig"`
	// DBBackendConfig *dbBackendConfig
}

type filestorageConfig struct {
	Backends []backendConfig `json:"backends"`
}

func newConfig(staticRootPath string) filestorageConfig {
	return filestorageConfig{
		Backends: []backendConfig{
			{
				Type: BackendTypeFS,
				Name: "public",
				AllowedPrefixes: []string{
					"testdata/",
					"img/icons/",
					"img/bg/",
					"gazetteer/",
					"maps/",
					"upload/",
				},
				SupportedOperations: []Operation{
					OperationListFiles, OperationListFolders,
				},
				FSBackendConfig: &fsBackendConfig{RootPath: staticRootPath},
			},
		},
	}
}
