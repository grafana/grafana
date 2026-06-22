package pulse

import (
	"errors"
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

// registerHookAPIEndpoints mounts the named-hook admin surface plus the
// mention-picker lookup. Management routes require pulse:admin (the
// same gate the Administration nav entry uses); the mention lookup only
// needs pulse:write so any author who can post can discover hooks to
// mention. All routes inherit the dashboardPulse feature gate.
func (s *PulseService) registerHookAPIEndpoints() {
	authorize := ac.Middleware(s.accessControl)
	write := ac.EvalPermission(ActionWrite)
	admin := ac.EvalPermission(ActionAdmin)

	s.routeRegister.Group("/api/pulse/hooks", func(r routing.RouteRegister) {
		// Mentionable lookup first so the more specific path wins over
		// the :uid GET below.
		r.Get("/mentionable", authorize(write), routing.Wrap(s.listMentionableHooksHandler))
		r.Get("/", authorize(admin), routing.Wrap(s.listHooksHandler))
		r.Post("/", authorize(admin), routing.Wrap(s.createHookHandler))
		r.Get("/:uid", authorize(admin), routing.Wrap(s.getHookHandler))
		r.Put("/:uid", authorize(admin), routing.Wrap(s.updateHookHandler))
		r.Delete("/:uid", authorize(admin), routing.Wrap(s.deleteHookHandler))
	}, middleware.ReqSignedIn, s.featureGate)
}

// swagger:route GET /pulse/hooks pulse alpha listPulseHooks
//
// List the named Pulse hooks configured in the caller's org.
//
// Requires pulse:admin. Secrets are never returned; `hasSecret`
// indicates whether one is configured.
//
// Responses:
// 200: pulseHooksResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *PulseService) listHooksHandler(c *contextmodel.ReqContext) response.Response {
	hooks, err := s.ListHooks(c.Req.Context(), ListHooksQuery{OrgID: c.GetOrgID()})
	if err != nil {
		return mapHookError(err, "Failed to list pulse hooks")
	}
	out := make([]Hook, 0, len(hooks))
	for _, h := range hooks {
		out = append(out, h.Sanitized())
	}
	return response.JSON(http.StatusOK, HooksResponse{Hooks: out})
}

// swagger:route POST /pulse/hooks pulse alpha createPulseHook
//
// Create a named Pulse hook.
//
// Requires pulse:admin. Name must be unique within the org.
//
// Responses:
// 200: pulseHookResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 409: conflictError
// 500: internalServerError
func (s *PulseService) createHookHandler(c *contextmodel.ReqContext) response.Response {
	cmd := CreateHookCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.GetOrgID()
	cmd.CreatedBy = s.actorUserID(c)
	h, err := s.CreateHook(c.Req.Context(), cmd)
	if err != nil {
		return mapHookError(err, "Failed to create pulse hook")
	}
	return response.JSON(http.StatusOK, h.Sanitized())
}

// swagger:route GET /pulse/hooks/{uid} pulse alpha getPulseHook
//
// Get a single named Pulse hook by UID. Requires pulse:admin.
//
// Responses:
// 200: pulseHookResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *PulseService) getHookHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	h, err := s.GetHook(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapHookError(err, "Failed to get pulse hook")
	}
	return response.JSON(http.StatusOK, h.Sanitized())
}

// swagger:route PUT /pulse/hooks/{uid} pulse alpha updatePulseHook
//
// Update a named Pulse hook. Requires pulse:admin. Omit `secret` to
// keep the stored secret; send an empty string to clear it.
//
// Responses:
// 200: pulseHookResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 409: conflictError
// 500: internalServerError
func (s *PulseService) updateHookHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	cmd := UpdateHookCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.GetOrgID()
	cmd.UID = uid
	h, err := s.UpdateHook(c.Req.Context(), cmd)
	if err != nil {
		return mapHookError(err, "Failed to update pulse hook")
	}
	return response.JSON(http.StatusOK, h.Sanitized())
}

// swagger:route DELETE /pulse/hooks/{uid} pulse alpha deletePulseHook
//
// Delete a named Pulse hook. Requires pulse:admin.
//
// Responses:
// 200: pulseGenericResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *PulseService) deleteHookHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":uid"]
	if err := s.DeleteHook(c.Req.Context(), DeleteHookCommand{OrgID: c.GetOrgID(), UID: uid}); err != nil {
		return mapHookError(err, "Failed to delete pulse hook")
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Hook deleted"})
}

// swagger:route GET /pulse/hooks/mentionable pulse alpha listMentionablePulseHooks
//
// List enabled Pulse hooks for the @-mention picker.
//
// Requires pulse:write (any author who can post a pulse). Results are
// capped (default 10, max 50) and matched case-insensitively against
// the hook name. Disabled hooks are excluded.
//
// Responses:
// 200: pulseHookMentionsResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *PulseService) listMentionableHooksHandler(c *contextmodel.ReqContext) response.Response {
	hits, err := s.ListMentionableHooks(c.Req.Context(), MentionableHooksQuery{
		OrgID: c.GetOrgID(),
		Query: strings.TrimSpace(c.Query("query")),
		Limit: int(c.QueryInt64("limit")),
	})
	if err != nil {
		return mapHookError(err, "Failed to list mentionable hooks")
	}
	return response.JSON(http.StatusOK, HookMentionsResponse{Hooks: hits})
}

// mapHookError maps hook service errors to HTTP status codes.
func mapHookError(err error, defaultMsg string) response.Response {
	switch {
	case errors.Is(err, ErrHookNotFound):
		return response.Error(http.StatusNotFound, err.Error(), err)
	case errors.Is(err, ErrHookNameDuplicate):
		return response.Error(http.StatusConflict, err.Error(), err)
	case errors.Is(err, ErrHookNameRequired),
		errors.Is(err, ErrHookNameTooLong),
		errors.Is(err, ErrHookInvalidType),
		errors.Is(err, ErrHookInvalidURL):
		return response.Error(http.StatusBadRequest, err.Error(), err)
	default:
		return response.Error(http.StatusInternalServerError, defaultMsg, err)
	}
}

// swagger:response pulseHooksResponse
type PulseHooksResponse struct {
	// in: body
	Body HooksResponse `json:"body"`
}

// swagger:response pulseHookResponse
type PulseHookResponse struct {
	// in: body
	Body Hook `json:"body"`
}

// swagger:response pulseHookMentionsResponse
type PulseHookMentionsResponse struct {
	// in: body
	Body HookMentionsResponse `json:"body"`
}
