package unified

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type WriteEvent struct {
	EventID    int64
	Key        *ResourceKey // the request key
	Requester  identity.Requester
	Operation  ResourceOperation
	PreviousRV int64 // only for Update+Delete

	// The raw JSON payload
	// NOTE, this is never mutated, only parsed and validated
	Value json.RawMessage

	Object    utils.GrafanaMetaAccessor
	OldObject utils.GrafanaMetaAccessor

	// Change metadata
	FolderChanged bool

	// The status will be populated for any error
	Status *StatusResult
	Error  error
}

func (e *WriteEvent) BadRequest(err error, message string, a ...any) *WriteEvent {
	e.Error = err
	e.Status = &StatusResult{
		Status:  "Failure",
		Message: fmt.Sprintf(message, a...),
		Code:    http.StatusBadRequest,
	}
	return e
}
