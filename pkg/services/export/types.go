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
	Format string          `json:"format"`
	Git    GitExportConfig `json:"git"`
}

type GitExportConfig struct {
	// General folder is either at the root or as a subfolder
	GeneralAtRoot bool `json:"generalAtRoot"`

	// Keeping all history is nice, but much slower
	ExcludeHistory bool `json:"excludeHistory"`
}

type Job interface {
	getStatus() ExportStatus
	getConfig() ExportConfig
}

// Will broadcast the live status
type statusBroadcaster func(s ExportStatus)
