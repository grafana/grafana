package export

import "time"

var _ Job = new(stoppedJob)

type stoppedJob struct {
}

func (e *stoppedJob) getStatus() ExportStatus {
	return ExportStatus{
		Running: false,
		Changed: time.Now().UnixMilli(),
	}
}

func (e *stoppedJob) getConfig() ExportConfig {
	return ExportConfig{}
}

func (e *stoppedJob) requestStop() {}
