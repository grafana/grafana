package import_export_plugin

import "github.com/grafana/grafana/pkg/infra/log"

var Log = log.New("bmc-plugins-api")

type ExportDTO struct {
	DashUIds   []string `json:"dashUids"`
	FolderUIds []string `json:"folderUids"`
}

type ErrorResult struct {
	Msg string
	Err error
}

func NewErrorResult(msg string, err error) *ErrorResult {
	return &ErrorResult{
		Msg: msg,
		Err: err,
	}
}
