package api

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

func sessionConflictResponse(err error) (response.Response, bool) {
	var conflict cloudmigration.SessionConflictError
	if !errors.As(err, &conflict) {
		return nil, false
	}

	message := "A migration operation is already in progress for this session."
	switch conflict.Workflow {
	case cloudmigration.SessionWorkflowBuildingSnapshot:
		message = "A snapshot is already being built for this session."
	case cloudmigration.SessionWorkflowUploadingSnapshot:
		message = "A snapshot is already being uploaded for this session."
	case cloudmigration.SessionWorkflowProcessingSnapshot:
		message = "A snapshot is already being processed for this session."
	}

	return response.JSON(http.StatusConflict, SessionConflictResponseDTO{
		Message:           message,
		MessageID:         "cloudmigrations.sessionBusy",
		Workflow:          toSessionWorkflowDTO(conflict.Workflow),
		ActiveSnapshotUID: conflict.ActiveSnapshotUID,
		CanForce:          conflict.CanForce,
	}), true
}
