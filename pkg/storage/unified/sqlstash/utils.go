package sqlstash

import (
	"net/http"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func badRequest(msg string) *resource.StatusResult {
	return &resource.StatusResult{
		Status:  "Failure",
		Message: msg,
		Code:    http.StatusBadRequest,
	}
}
