package export

// Export status.  Only one running at a time
type ExportStatus struct {
	Running  bool           `json:"running"`
	Target   string         `json:"target"` // description of where it is going (no secrets)
	Started  int64          `json:"started,omitempty"`
	Finished int64          `json:"finished,omitempty"`
	Changed  int64          `json:"update,omitempty"`
	Last     string         `json:"last,omitempty"`
	Status   string         `json:"status"` // ERROR, SUCCESS, ETC
	Index    int            `json:"index,omitempty"`
	Count    map[string]int `json:"count,omitempty"`
}

// Basic export config (for now)
type ExportConfig struct {
	Format            string `json:"format"`
	GeneralFolderPath string `json:"generalFolderPath"`
	KeepHistory       bool   `json:"history"`

	Exclude map[string]bool `json:"exclude"`

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

type Exporter struct {
	Key         string     `json:"key"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Exporters   []Exporter `json:"exporters,omitempty"`

	process func(helper *commitHelper, job *gitExportJob) error
}
