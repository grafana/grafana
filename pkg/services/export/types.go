package export

// Export status.  Only one running at a time
type ExportStatus struct {
	Running  bool   `json:"running"`
	Target   string `json:"target"` // description of where it is going (no secrets)
	Started  int64  `json:"started,omitempty"`
	Finished int64  `json:"finished,omitempty"`
	Changed  int64  `json:"update,omitempty"`
	Count    int64  `json:"count,omitempty"`
	Current  int64  `json:"current,omitempty"`
	Last     string `json:"last,omitempty"`
	Status   string `json:"status"` // ERROR, SUCCESS, ETC
}

// Basic export config (for now)
type ExportConfig struct {
	Format            string `json:"format"`
	GeneralFolderPath string `json:"generalFolderPath"`
	KeepHistory       bool   `json:"history"`

	Include struct {
		Auth      bool `json:"auth"`
		DS        bool `json:"ds"`
		Dash      bool `json:"dash"`
		Services  bool `json:"services"`
		Usage     bool `json:"usage"`
		Anno      bool `json:"anno"`
		Snapshots bool `json:"snapshots"`
	} `json:"include"`

	// Depends on the format
	Git GitExportConfig `json:"git"`
}

type GitExportConfig struct{}

type Job interface {
	getStatus() ExportStatus
	getConfig() ExportConfig
	requestStop()
}

// Will broadcast the live status
type statusBroadcaster func(s ExportStatus)
