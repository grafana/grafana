package resource

import (
	"fmt"
	"net/http"
)

func badRequest(format string, a ...any) *StatusResult {
	return &StatusResult{
		Status:  "Failure",
		Message: fmt.Sprintf(format, a...),
		Code:    http.StatusBadRequest,
	}
}
