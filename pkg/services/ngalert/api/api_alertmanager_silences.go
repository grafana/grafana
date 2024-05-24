package api

import (
	"context"
	"net/http"

	"github.com/go-openapi/strfmt"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/util"
)

// SilenceService is the service for managing and authenticating silences access in Grafana AM.
type SilenceService interface {
	GetSilence(ctx context.Context, user identity.Requester, silenceID string) (*models.Silence, error)
	ListSilences(ctx context.Context, user identity.Requester, filter []string) ([]*models.Silence, error)
	CreateSilence(ctx context.Context, user identity.Requester, ps models.Silence) (string, error)
	UpdateSilence(ctx context.Context, user identity.Requester, ps models.Silence) (string, error)
	DeleteSilence(ctx context.Context, user identity.Requester, silenceID string) error
	WithAccessControlMetadata(ctx context.Context, user identity.Requester, silencesWithMetadata ...*models.SilenceWithMetadata) error
	WithRuleMetadata(ctx context.Context, user identity.Requester, silences ...*models.SilenceWithMetadata) error
}

// RouteGetSilence is the single silence GET endpoint for Grafana AM.
func (srv AlertmanagerSrv) RouteGetSilence(c *contextmodel.ReqContext, silenceID string) response.Response {
	silence, err := srv.silenceSvc.GetSilence(c.Req.Context(), c.SignedInUser, silenceID)
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to get silence", err)
	}

	silenceWithMetadata := &models.SilenceWithMetadata{
		Silence: silence,
	}
	if c.QueryBool("accesscontrol") {
		if err := srv.silenceSvc.WithAccessControlMetadata(c.Req.Context(), c.SignedInUser, silenceWithMetadata); err != nil {
			srv.log.Error("failed to get silence access control metadata", "silenceID", silenceID, "error", err)
		}
	}
	if c.QueryBool("ruleMetadata") {
		if err := srv.silenceSvc.WithRuleMetadata(c.Req.Context(), c.SignedInUser, silenceWithMetadata); err != nil {
			srv.log.Error("failed to get silence rule metadata", "silenceID", silenceID, "error", err)
		}
	}

	return response.JSON(http.StatusOK, SilenceToGettableGrafanaSilence(silenceWithMetadata))
}

// RouteGetSilences is the silence list GET endpoint for Grafana AM.
func (srv AlertmanagerSrv) RouteGetSilences(c *contextmodel.ReqContext) response.Response {
	silences, err := srv.silenceSvc.ListSilences(c.Req.Context(), c.SignedInUser, c.QueryStrings("filter"))
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to list silence", err)
	}

	silencesWithMetadata := withNoMetadata(silences...)
	if c.QueryBool("accesscontrol") {
		if err := srv.silenceSvc.WithAccessControlMetadata(c.Req.Context(), c.SignedInUser, silencesWithMetadata...); err != nil {
			srv.log.Error("failed to get silence access control metadata", "error", err)
		}
	}
	if c.QueryBool("ruleMetadata") {
		if err := srv.silenceSvc.WithRuleMetadata(c.Req.Context(), c.SignedInUser, silencesWithMetadata...); err != nil {
			srv.log.Error("failed to get silence rule metadata", "error", err)
		}
	}
	return response.JSON(http.StatusOK, SilencesToGettableGrafanaSilences(silencesWithMetadata))
}

// RouteCreateSilence is the silence POST (create + update) endpoint for Grafana AM.
func (srv AlertmanagerSrv) RouteCreateSilence(c *contextmodel.ReqContext, postableSilence apimodels.PostableSilence) response.Response {
	err := postableSilence.Validate(strfmt.Default)
	if err != nil {
		srv.log.Error("Silence failed validation", "error", err)
		return ErrResp(http.StatusBadRequest, err, "silence failed validation")
	}
	action := srv.silenceSvc.UpdateSilence
	if postableSilence.ID == "" {
		action = srv.silenceSvc.CreateSilence
	}
	silenceID, err := action(c.Req.Context(), c.SignedInUser, PostableSilenceToSilence(postableSilence))
	if err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to create/update silence", err)
	}

	return response.JSON(http.StatusAccepted, apimodels.PostSilencesOKBody{
		SilenceID: silenceID,
	})
}

// RouteDeleteSilence is the silence DELETE endpoint for Grafana AM.
func (srv AlertmanagerSrv) RouteDeleteSilence(c *contextmodel.ReqContext, silenceID string) response.Response {
	if err := srv.silenceSvc.DeleteSilence(c.Req.Context(), c.SignedInUser, silenceID); err != nil {
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to delete silence", err)
	}
	return response.JSON(http.StatusOK, util.DynMap{"message": "silence deleted"})
}

func withNoMetadata(silences ...*models.Silence) []*models.SilenceWithMetadata {
	silencesWithMetadata := make([]*models.SilenceWithMetadata, 0, len(silences))
	for _, silence := range silences {
		silencesWithMetadata = append(silencesWithMetadata, &models.SilenceWithMetadata{
			Silence: silence,
		})
	}
	return silencesWithMetadata
}
