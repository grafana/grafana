package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

func TestSessionConflictResponse(t *testing.T) {
	t.Parallel()

	resp, ok := sessionConflictResponse(cloudmigration.SessionConflictError{
		Workflow:          cloudmigration.SessionWorkflowBuildingSnapshot,
		ActiveSnapshotUID: "snap1",
		CanForce:          true,
	})
	require.True(t, ok)
	require.Equal(t, http.StatusConflict, resp.Status())

	var dto SessionConflictResponseDTO
	require.NoError(t, json.Unmarshal(resp.Body(), &dto))
	require.Equal(t, "cloudmigrations.sessionBusy", dto.MessageID)
	require.True(t, dto.CanForce)
	require.Equal(t, SessionWorkflowBuildingSnapshot, dto.Workflow)
	require.Equal(t, "snap1", dto.ActiveSnapshotUID)

	_, ok = sessionConflictResponse(errors.New("other"))
	require.False(t, ok)
}
