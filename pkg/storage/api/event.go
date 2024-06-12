package api

import (
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/auth/identity"
)

type WriteEvent struct {
	EventID    int64
	Key        *ResourceKey // the request key
	Requester  identity.Requester
	Operation  ResourceOperation
	PreviousRV int64 // only for Update+Delete
	Value      []byte

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
