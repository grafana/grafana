package pref

import (
	"context"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
)

type Service interface {
	GetWithDefaults(context.Context, *GetPreferenceWithDefaultsQuery) (*Preference, error)
	Get(context.Context, *GetPreferenceQuery) (*Preference, error)
	Save(context.Context, *SavePreferenceCommand) error
	Patch(context.Context, *PatchPreferenceCommand) error
	GetDefaults() *Preference
	DeleteByUser(context.Context, int64) error
}

type HTTPService interface {
	GetOrgPreferences(c *models.ReqContext) response.Response
	UpdateOrgPreferences(c *models.ReqContext) response.Response
	PatchOrgPreferences(c *models.ReqContext) response.Response
}
