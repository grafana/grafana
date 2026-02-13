package client

import (
	"context"
	"fmt"
	"net/http"
)

const (
	alertmanagerLimitsPath = "/api/v1/limits"
)

// SilenceLimits contains limits related to silences.
type SilenceLimits struct {
	MaxSilencesCount    int `json:"max_silences_count"`
	MaxSilenceSizeBytes int `json:"max_silence_size_bytes"`
}

// TemplateLimits contains limits related to templates.
type TemplateLimits struct {
	MaxTemplatesCount    int `json:"max_templates_count"`
	MaxTemplateSizeBytes int `json:"max_template_size_bytes"`
}

// TenantLimits contains all limit categories for a tenant.
type TenantLimits struct {
	Silences  *SilenceLimits  `json:"silences,omitempty"`
	Templates *TemplateLimits `json:"templates,omitempty"`
}

// GetLimits retrieves the tenant-scoped limits from the remote Alertmanager.
func (mc *Mimir) GetLimits(ctx context.Context) (*TenantLimits, error) {
	limits := &TenantLimits{}
	response := successResponse{
		Data: limits,
	}
	// nolint:bodyclose
	// closed within `do`
	_, err := mc.do(ctx, alertmanagerLimitsPath, http.MethodGet, nil, &response)
	if err != nil {
		return nil, err
	}

	if response.Status != "success" {
		return nil, fmt.Errorf("returned non-success `status` from the MimirAPI: %s", response.Status)
	}

	return limits, nil
}
