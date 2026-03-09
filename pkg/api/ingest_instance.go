package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ngalert/ingestinstance"
	"github.com/grafana/grafana/pkg/web"
)

// --- Request / Response DTOs ---

// CreateIngestInstanceRequest is the request body for creating a new ingest instance.
type CreateIngestInstanceRequest struct {
	Name     string          `json:"name"`
	PluginID string          `json:"pluginId"`
	Settings json.RawMessage `json:"settings"`
}

// IngestInstanceResponse is the API representation of an ingest instance.
type IngestInstanceResponse struct {
	Token     string          `json:"token"`
	Name      string          `json:"name"`
	PluginID  string          `json:"pluginId"`
	Settings  json.RawMessage `json:"settings"`
	CreatedAt time.Time       `json:"createdAt"`
	UpdatedAt time.Time       `json:"updatedAt"`
}

func instanceToResponse(inst *ingestinstance.Instance) IngestInstanceResponse {
	return IngestInstanceResponse{
		Token:     inst.Token,
		Name:      inst.Name,
		PluginID:  inst.PluginID,
		Settings:  inst.Settings,
		CreatedAt: inst.CreatedAt,
		UpdatedAt: inst.UpdatedAt,
	}
}

// --- Handlers ---

// ListIngestInstances returns all ingest instances for the current org.
//
// GET /api/alerting/ingest-instances
func (hs *HTTPServer) ListIngestInstances(c *contextmodel.ReqContext) response.Response {
	instances, err := hs.ingestInstanceStore.ListByOrg(c.Req.Context(), c.GetOrgID())
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to list ingest instances", err)
	}

	result := make([]IngestInstanceResponse, 0, len(instances))
	for _, inst := range instances {
		result = append(result, instanceToResponse(inst))
	}
	return response.JSON(http.StatusOK, result)
}

// CreateIngestInstance creates a new ingest instance with a generated token.
//
// POST /api/alerting/ingest-instances
func (hs *HTTPServer) CreateIngestInstance(c *contextmodel.ReqContext) response.Response {
	var req CreateIngestInstanceRequest
	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "Invalid request body", err)
	}

	if req.PluginID == "" {
		return response.Error(http.StatusBadRequest, "pluginId is required", nil)
	}
	if req.Settings == nil {
		req.Settings = json.RawMessage("{}")
	}
	if !json.Valid(req.Settings) || (len(req.Settings) > 0 && req.Settings[0] != '{') {
		return response.Error(http.StatusBadRequest, "settings must be a valid JSON object", nil)
	}

	instance := &ingestinstance.Instance{
		Token:    uuid.New().String(),
		Name:     req.Name,
		PluginID: req.PluginID,
		OrgID:    c.GetOrgID(),
		Settings: req.Settings,
	}

	if err := hs.ingestInstanceStore.Create(c.Req.Context(), instance); err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to create ingest instance", err)
	}

	// Re-read to get the store-assigned timestamps.
	created, err := hs.ingestInstanceStore.GetByToken(c.Req.Context(), instance.Token)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "Failed to read created instance", err)
	}

	return response.JSON(http.StatusCreated, instanceToResponse(created))
}

// UpdateIngestInstance updates the settings for an existing ingest instance.
//
// PUT /api/alerting/ingest-instances/:token
func (hs *HTTPServer) UpdateIngestInstance(c *contextmodel.ReqContext) response.Response {
	token := web.Params(c.Req)[":token"]

	var req struct {
		Name     string          `json:"name"`
		Settings json.RawMessage `json:"settings"`
	}
	if err := web.Bind(c.Req, &req); err != nil {
		return response.Error(http.StatusBadRequest, "Invalid request body", err)
	}
	if req.Settings == nil {
		return response.Error(http.StatusBadRequest, "settings is required", nil)
	}
	if !json.Valid(req.Settings) || (len(req.Settings) > 0 && req.Settings[0] != '{') {
		return response.Error(http.StatusBadRequest, "settings must be a valid JSON object", nil)
	}

	updated, err := hs.ingestInstanceStore.Update(c.Req.Context(), c.GetOrgID(), token, req.Name, req.Settings)
	if err != nil {
		if errors.Is(err, ingestinstance.ErrInstanceNotFound) {
			return response.Error(http.StatusNotFound, "Ingest instance not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to update ingest instance", err)
	}

	return response.JSON(http.StatusOK, instanceToResponse(updated))
}

// DeleteIngestInstance deletes an ingest instance by token.
//
// DELETE /api/alerting/ingest-instances/:token
func (hs *HTTPServer) DeleteIngestInstance(c *contextmodel.ReqContext) response.Response {
	token := web.Params(c.Req)[":token"]

	if err := hs.ingestInstanceStore.Delete(c.Req.Context(), c.GetOrgID(), token); err != nil {
		if errors.Is(err, ingestinstance.ErrInstanceNotFound) {
			return response.Error(http.StatusNotFound, "Ingest instance not found", nil)
		}
		return response.Error(http.StatusInternalServerError, "Failed to delete ingest instance", err)
	}

	return response.JSON(http.StatusOK, map[string]string{"message": "Instance deleted"})
}
