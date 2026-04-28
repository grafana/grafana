package pulse

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/web"
)

// registerAPIEndpoints mounts the Pulse REST API. All routes share the
// same feature-toggle gate; if dashboardPulse is disabled, every route
// returns 404 so the surface is invisible to clients.
func (s *PulseService) registerAPIEndpoints() {
	authorize := ac.Middleware(s.accessControl)
	dashRead := ac.EvalPermission(dashboards.ActionDashboardsRead, dashboards.ScopeDashboardsAll)

	s.routeRegister.Group("/api/pulse", func(r routing.RouteRegister) {
		r.Get("/threads", authorize(dashRead), routing.Wrap(s.listThreadsHandler))
		r.Post("/threads", authorize(dashRead), routing.Wrap(s.createThreadHandler))
		r.Get("/threads/:threadUID", authorize(dashRead), routing.Wrap(s.getThreadHandler))
		r.Get("/threads/:threadUID/pulses", authorize(dashRead), routing.Wrap(s.listPulsesHandler))
		r.Post("/threads/:threadUID/pulses", authorize(dashRead), routing.Wrap(s.addPulseHandler))
		r.Patch("/pulses/:pulseUID", authorize(dashRead), routing.Wrap(s.editPulseHandler))
		r.Delete("/pulses/:pulseUID", authorize(dashRead), routing.Wrap(s.deletePulseHandler))
		r.Post("/threads/:threadUID/subscribe", authorize(dashRead), routing.Wrap(s.subscribeHandler))
		r.Post("/threads/:threadUID/unsubscribe", authorize(dashRead), routing.Wrap(s.unsubscribeHandler))
		r.Post("/threads/:threadUID/read", authorize(dashRead), routing.Wrap(s.markReadHandler))
		r.Get("/resources/:kind/:uid/version", authorize(dashRead), routing.Wrap(s.getResourceVersionHandler))
	}, middleware.ReqSignedIn, s.featureGate)
}

// featureGate denies every Pulse request unless the dashboardPulse toggle
// is enabled. Returning 404 (not 403) keeps the feature invisible.
func (s *PulseService) featureGate(c *contextmodel.ReqContext) {
	if !s.features.IsEnabled(c.Req.Context(), featuremgmt.FlagDashboardPulse) {
		c.JsonApiErr(http.StatusNotFound, "Pulse is not enabled", nil)
		return
	}
}

func (s *PulseService) actorUserID(c *contextmodel.ReqContext) int64 {
	id, err := identity.UserIdentifier(c.GetID())
	if err != nil {
		return 0
	}
	return id
}

func (s *PulseService) actorAuthorKind(c *contextmodel.ReqContext) AuthorKind {
	if c.SignedInUser != nil && c.SignedInUser.IsServiceAccountUser() {
		return AuthorKindServiceAccount
	}
	return AuthorKindUser
}

// swagger:route POST /pulse/threads pulse pulse createThread
//
// Create a new pulse thread.
//
// Threads are attached to a resource (currently `dashboard`). The first
// pulse is created in the same call so a thread is never observed empty.
//
// Responses:
// 200: pulseCreateThreadResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *PulseService) createThreadHandler(c *contextmodel.ReqContext) response.Response {
	cmd := CreateThreadCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.GetOrgID()
	cmd.AuthorUserID = s.actorUserID(c)
	cmd.AuthorKind = s.actorAuthorKind(c)

	if err := s.assertCanReadResource(c, cmd.ResourceKind, cmd.ResourceUID); err != nil {
		return err
	}

	res, err := s.CreateThread(c.Req.Context(), cmd)
	if err != nil {
		return mapPulseError(err, "Failed to create thread")
	}
	return response.JSON(http.StatusOK, res)
}

// swagger:route GET /pulse/threads pulse pulse listThreads
//
// List threads attached to a resource.
//
// Responses:
// 200: pulseListThreadsResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *PulseService) listThreadsHandler(c *contextmodel.ReqContext) response.Response {
	q := ListThreadsQuery{
		OrgID:        c.GetOrgID(),
		ResourceKind: ResourceKind(c.Query("resourceKind")),
		ResourceUID:  c.Query("resourceUID"),
		Cursor:       c.Query("cursor"),
		Limit:        int(c.QueryInt64("limit")),
	}
	if pid := c.Query("panelId"); pid != "" {
		if v, err := strconv.ParseInt(pid, 10, 64); err == nil {
			q.PanelID = &v
		}
	}
	if err := s.assertCanReadResource(c, q.ResourceKind, q.ResourceUID); err != nil {
		return err
	}
	res, err := s.ListThreads(c.Req.Context(), q)
	if err != nil {
		return mapPulseError(err, "Failed to list threads")
	}
	return response.JSON(http.StatusOK, res)
}

func (s *PulseService) getThreadHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	t, err := s.GetThread(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapPulseError(err, "Failed to get thread")
	}
	if err := s.assertCanReadResource(c, t.ResourceKind, t.ResourceUID); err != nil {
		return err
	}
	return response.JSON(http.StatusOK, t)
}

func (s *PulseService) listPulsesHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	t, err := s.GetThread(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapPulseError(err, "Failed to get thread")
	}
	if err := s.assertCanReadResource(c, t.ResourceKind, t.ResourceUID); err != nil {
		return err
	}
	q := ListPulsesQuery{
		OrgID:     c.GetOrgID(),
		ThreadUID: uid,
		Limit:     int(c.QueryInt64("limit")),
		Cursor:    c.Query("cursor"),
	}
	res, err := s.ListPulses(c.Req.Context(), q)
	if err != nil {
		return mapPulseError(err, "Failed to list pulses")
	}
	return response.JSON(http.StatusOK, res)
}

func (s *PulseService) addPulseHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	t, err := s.GetThread(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapPulseError(err, "Failed to get thread")
	}
	if err := s.assertCanReadResource(c, t.ResourceKind, t.ResourceUID); err != nil {
		return err
	}
	cmd := AddPulseCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.GetOrgID()
	cmd.ThreadUID = uid
	cmd.AuthorUserID = s.actorUserID(c)
	cmd.AuthorKind = s.actorAuthorKind(c)
	p, err := s.AddPulse(c.Req.Context(), cmd)
	if err != nil {
		return mapPulseError(err, "Failed to add pulse")
	}
	return response.JSON(http.StatusOK, p)
}

func (s *PulseService) editPulseHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":pulseUID"]
	cmd := EditPulseCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.GetOrgID()
	cmd.UID = uid
	cmd.UserID = s.actorUserID(c)
	p, err := s.EditPulse(c.Req.Context(), cmd)
	if err != nil {
		return mapPulseError(err, "Failed to edit pulse")
	}
	return response.JSON(http.StatusOK, p)
}

func (s *PulseService) deletePulseHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":pulseUID"]
	cmd := DeletePulseCommand{
		OrgID:   c.GetOrgID(),
		UID:     uid,
		UserID:  s.actorUserID(c),
		IsAdmin: c.SignedInUser != nil && c.SignedInUser.HasRole("Admin"),
	}
	if err := s.DeletePulse(c.Req.Context(), cmd); err != nil {
		return mapPulseError(err, "Failed to delete pulse")
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Pulse deleted"})
}

func (s *PulseService) subscribeHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	if err := s.Subscribe(c.Req.Context(), SubscribeCommand{
		OrgID:     c.GetOrgID(),
		ThreadUID: uid,
		UserID:    s.actorUserID(c),
	}); err != nil {
		return mapPulseError(err, "Failed to subscribe")
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Subscribed"})
}

func (s *PulseService) unsubscribeHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	if err := s.Unsubscribe(c.Req.Context(), SubscribeCommand{
		OrgID:     c.GetOrgID(),
		ThreadUID: uid,
		UserID:    s.actorUserID(c),
	}); err != nil {
		return mapPulseError(err, "Failed to unsubscribe")
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Unsubscribed"})
}

func (s *PulseService) markReadHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	cmd := MarkReadCommand{}
	if err := web.Bind(c.Req, &cmd); err != nil {
		return response.Error(http.StatusBadRequest, "bad request data", err)
	}
	cmd.OrgID = c.GetOrgID()
	cmd.ThreadUID = uid
	cmd.UserID = s.actorUserID(c)
	if err := s.MarkRead(c.Req.Context(), cmd); err != nil {
		return mapPulseError(err, "Failed to mark read")
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Marked read"})
}

func (s *PulseService) getResourceVersionHandler(c *contextmodel.ReqContext) response.Response {
	kind := ResourceKind(web.Params(c.Req)[":kind"])
	uid := web.Params(c.Req)[":uid"]
	if err := s.assertCanReadResource(c, kind, uid); err != nil {
		return err
	}
	rv, err := s.GetResourceVersion(c.Req.Context(), c.GetOrgID(), kind, uid)
	if err != nil {
		return mapPulseError(err, "Failed to get resource version")
	}
	return response.JSON(http.StatusOK, rv)
}

// assertCanReadResource defers to the existing dashboard guardian for v1.
// We do not consult the pulse_thread row here — the thread is irrelevant
// for permission; only the underlying resource matters. Callers that have
// already loaded the thread can pass its (kind, uid) directly.
func (s *PulseService) assertCanReadResource(c *contextmodel.ReqContext, kind ResourceKind, uid string) response.Response {
	if !kind.Valid() {
		return response.Error(http.StatusBadRequest, "Invalid resource kind", ErrInvalidResourceKind)
	}
	if uid == "" {
		return response.Error(http.StatusBadRequest, "Missing resource UID", ErrThreadResourceMissing)
	}
	switch kind {
	case ResourceKindDashboard:
		dash, err := s.dashSvc.GetDashboard(c.Req.Context(), &dashboards.GetDashboardQuery{
			UID:   uid,
			OrgID: c.GetOrgID(),
		})
		if err != nil || dash == nil {
			return response.Error(http.StatusNotFound, "Dashboard not found", err)
		}
	}
	return nil
}

// mapPulseError converts a service-level error to the right HTTP code.
func mapPulseError(err error, defaultMsg string) response.Response {
	switch {
	case errors.Is(err, ErrThreadNotFound), errors.Is(err, ErrPulseNotFound):
		return response.Error(http.StatusNotFound, err.Error(), err)
	case errors.Is(err, ErrInvalidResourceKind),
		errors.Is(err, ErrInvalidBody),
		errors.Is(err, ErrEmptyBody),
		errors.Is(err, ErrBodyTooLarge),
		errors.Is(err, ErrBodyDisallowedNode),
		errors.Is(err, ErrBodyInvalidLink),
		errors.Is(err, ErrBodyInvalidMention),
		errors.Is(err, ErrParentPulseMismatch),
		errors.Is(err, ErrParentPulseDeleted),
		errors.Is(err, ErrThreadResourceMissing):
		return response.Error(http.StatusBadRequest, err.Error(), err)
	case errors.Is(err, ErrCannotEditNotAuthor),
		errors.Is(err, ErrCannotDeleteForbidden),
		errors.Is(err, ErrAccessDenied):
		return response.Error(http.StatusForbidden, err.Error(), err)
	case errors.Is(err, ErrPulseAlreadyDeleted):
		return response.Error(http.StatusGone, err.Error(), err)
	default:
		return response.Error(http.StatusInternalServerError, defaultMsg, err)
	}
}

// swagger:response pulseCreateThreadResponse
type pulseCreateThreadResponse struct {
	// in: body
	Body CreateThreadResult `json:"body"`
}

// swagger:response pulseListThreadsResponse
type pulseListThreadsResponse struct {
	// in: body
	Body PageResult[Thread] `json:"body"`
}
