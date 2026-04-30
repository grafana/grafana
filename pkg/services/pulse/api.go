package pulse

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
//
// Each route gates on a Pulse RBAC action *and* every handler additionally
// asserts dashboards:read on the resource via assertCanReadResource. The
// two layers are intentional: the action gate decides whether a caller may
// use the comment surface at all (an org admin could revoke pulse:write
// from a custom role); the dashboard check decides which dashboards they
// can interact with.
func (s *PulseService) registerAPIEndpoints() {
	authorize := ac.Middleware(s.accessControl)
	read := ac.EvalPermission(ActionRead)
	write := ac.EvalPermission(ActionWrite)
	del := ac.EvalPermission(ActionDelete)
	admin := ac.EvalPermission(ActionAdmin)
	// Author-or-admin handlers (delete pulse, delete thread, close): we
	// authorise either the privileged action or the baseline write
	// action. The service layer enforces the actual author check using
	// the caller's user id, so a viewer/editor who happens to be the
	// thread author can still close their own thread.
	deleteOrAdmin := ac.EvalAny(admin, del)
	writeOrAdmin := ac.EvalAny(admin, write)

	s.routeRegister.Group("/api/pulse", func(r routing.RouteRegister) {
		r.Get("/threads", authorize(read), routing.Wrap(s.listThreadsHandler))
		r.Get("/threads/all", authorize(read), routing.Wrap(s.listAllThreadsHandler))
		r.Post("/threads", authorize(write), routing.Wrap(s.createThreadHandler))
		r.Get("/threads/:threadUID", authorize(read), routing.Wrap(s.getThreadHandler))
		r.Delete("/threads/:threadUID", authorize(deleteOrAdmin), routing.Wrap(s.deleteThreadHandler))
		r.Post("/threads/:threadUID/close", authorize(writeOrAdmin), routing.Wrap(s.closeThreadHandler))
		r.Post("/threads/:threadUID/reopen", authorize(admin), routing.Wrap(s.reopenThreadHandler))
		r.Get("/threads/:threadUID/pulses", authorize(read), routing.Wrap(s.listPulsesHandler))
		r.Post("/threads/:threadUID/pulses", authorize(write), routing.Wrap(s.addPulseHandler))
		r.Patch("/pulses/:pulseUID", authorize(write), routing.Wrap(s.editPulseHandler))
		r.Delete("/pulses/:pulseUID", authorize(deleteOrAdmin), routing.Wrap(s.deletePulseHandler))
		r.Post("/threads/:threadUID/subscribe", authorize(read), routing.Wrap(s.subscribeHandler))
		r.Post("/threads/:threadUID/unsubscribe", authorize(read), routing.Wrap(s.unsubscribeHandler))
		r.Post("/threads/:threadUID/read", authorize(read), routing.Wrap(s.markReadHandler))
		r.Get("/resources/:kind/:uid/version", authorize(read), routing.Wrap(s.getResourceVersionHandler))
	}, middleware.ReqSignedIn, s.featureGate)
}

// featureGate denies every Pulse request unless the dashboardPulse toggle
// is enabled. Returning 404 (not 403) keeps the feature invisible.
func (s *PulseService) featureGate(c *contextmodel.ReqContext) {
	//nolint:staticcheck // not yet migrated to OpenFeature
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
	if c.SignedInUser != nil && c.IsServiceAccountUser() {
		return AuthorKindServiceAccount
	}
	return AuthorKindUser
}

// swagger:route POST /pulse/threads pulse alpha createThread
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
	threads := []Thread{res.Thread}
	s.populateThreadPreviews(c.Req.Context(), c.GetOrgID(), threads)
	res.Thread = threads[0]
	return response.JSON(http.StatusOK, res)
}

// swagger:route GET /pulse/threads pulse alpha listThreads
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
	s.populateThreadPreviews(c.Req.Context(), c.GetOrgID(), res.Items)
	return response.JSON(http.StatusOK, res)
}

// populateThreadPreviews backfills the first pulse's body AST and the
// thread starter's display fields onto each row in place. The frontend
// renders the body via the same renderer used in-thread, which keeps
// mention chips, panel `#` prefixes, and link styling consistent across
// both views.
func (s *PulseService) populateThreadPreviews(ctx context.Context, orgID int64, threads []Thread) {
	if len(threads) == 0 {
		return
	}
	uids := make([]string, 0, len(threads))
	authorIDs := make([]int64, 0, len(threads))
	seenAuthor := make(map[int64]bool, len(threads))
	for _, t := range threads {
		uids = append(uids, t.UID)
		if t.CreatedBy > 0 && !seenAuthor[t.CreatedBy] {
			seenAuthor[t.CreatedBy] = true
			authorIDs = append(authorIDs, t.CreatedBy)
		}
	}
	bodies, err := s.store.firstPulseBodiesByThread(ctx, orgID, uids)
	if err != nil {
		s.log.Warn("failed to load thread previews", "err", err)
	}
	type displayInfo struct {
		name, login, avatarURL string
	}
	authorByID := make(map[int64]displayInfo)
	if s.userSvc != nil && len(authorIDs) > 0 {
		users, lerr := s.userSvc.ListByIdOrUID(ctx, nil, authorIDs)
		if lerr != nil {
			s.log.Warn("failed to resolve thread starters", "err", lerr)
		}
		for _, u := range users {
			if u == nil {
				continue
			}
			authorByID[u.ID] = displayInfo{
				name:      u.Name,
				login:     u.Login,
				avatarURL: gravatarAvatarURL(u.Email),
			}
		}
	}
	for i := range threads {
		if bodies != nil {
			threads[i].PreviewBody = bodies[threads[i].UID]
		}
		if d, ok := authorByID[threads[i].CreatedBy]; ok {
			threads[i].AuthorName = d.name
			threads[i].AuthorLogin = d.login
			threads[i].AuthorAvatarURL = d.avatarURL
		}
	}
}

// swagger:route GET /pulse/threads/all pulse alpha listAllThreads
//
// List threads across the entire org (powers the Pulse overview page).
//
// Optional query parameters:
//   - q: text search across thread titles and pulse body text (case-insensitive)
//   - mine: when "true", restrict to threads the caller authored or is subscribed to
//   - status: "open" or "closed" to filter by close state; absent / any other
//     value returns every thread regardless of state
//   - page, limit: 1-indexed offset pagination (defaults: page=1, limit=25, max=100)
//
// Each item is decorated with `resourceTitle` (e.g. dashboard title), the
// thread starter's display fields, and the first pulse's body for preview.
//
// Responses:
// 200: pulseListThreadsResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *PulseService) listAllThreadsHandler(c *contextmodel.ReqContext) response.Response {
	q := ListAllThreadsQuery{
		OrgID:    c.GetOrgID(),
		UserID:   s.actorUserID(c),
		Query:    strings.TrimSpace(c.Query("q")),
		MineOnly: c.QueryBool("mine"),
		Status:   parseStatusFilter(c.Query("status")),
		Page:     int(c.QueryInt64("page")),
		Limit:    int(c.QueryInt64("limit")),
	}
	res, err := s.ListAllThreads(c.Req.Context(), q)
	if err != nil {
		return mapPulseError(err, "Failed to list threads")
	}
	s.populateThreadPreviews(c.Req.Context(), c.GetOrgID(), res.Items)
	s.populateResourceTitles(c.Req.Context(), c.GetOrgID(), res.Items)
	return response.JSON(http.StatusOK, res)
}

// parseStatusFilter coerces the raw ?status= query value into a typed
// filter. Anything outside the {open,closed} allowlist becomes the
// "any" zero value so a typo never silently filters the listing — the
// user just sees every thread, which is a safe default.
func parseStatusFilter(raw string) ThreadStatusFilter {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case string(ThreadStatusOpen):
		return ThreadStatusOpen
	case string(ThreadStatusClosed):
		return ThreadStatusClosed
	default:
		return ThreadStatusAny
	}
}

// populateResourceTitles backfills Thread.ResourceTitle for the global
// overview page. We batch-fetch dashboards by UID (one query per page,
// not per thread). Threads whose dashboard cannot be resolved keep an
// empty title and the frontend falls back to showing the UID.
func (s *PulseService) populateResourceTitles(ctx context.Context, orgID int64, threads []Thread) {
	if len(threads) == 0 || s.dashSvc == nil {
		return
	}
	uidSet := make(map[string]struct{}, len(threads))
	for _, t := range threads {
		if t.ResourceKind == ResourceKindDashboard && t.ResourceUID != "" {
			uidSet[t.ResourceUID] = struct{}{}
		}
	}
	if len(uidSet) == 0 {
		return
	}
	uids := make([]string, 0, len(uidSet))
	for uid := range uidSet {
		uids = append(uids, uid)
	}
	dashes, err := s.dashSvc.GetDashboards(ctx, &dashboards.GetDashboardsQuery{
		OrgID:         orgID,
		DashboardUIDs: uids,
	})
	if err != nil {
		s.log.Warn("failed to resolve dashboard titles", "err", err)
		return
	}
	titles := make(map[string]string, len(dashes))
	for _, d := range dashes {
		if d == nil {
			continue
		}
		titles[d.UID] = d.Title
	}
	for i := range threads {
		if threads[i].ResourceKind != ResourceKindDashboard {
			continue
		}
		if title, ok := titles[threads[i].ResourceUID]; ok {
			threads[i].ResourceTitle = title
		}
	}
}

// swagger:route GET /pulse/threads/{threadUID} pulse alpha getThread
//
// Get a single pulse thread.
//
// Responses:
// 200: pulseGetThreadResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *PulseService) getThreadHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	t, err := s.GetThread(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapPulseError(err, "Failed to get thread")
	}
	if err := s.assertCanReadResource(c, t.ResourceKind, t.ResourceUID); err != nil {
		return err
	}
	one := []Thread{t}
	s.populateThreadPreviews(c.Req.Context(), c.GetOrgID(), one)
	return response.JSON(http.StatusOK, one[0])
}

// swagger:route GET /pulse/threads/{threadUID}/pulses pulse alpha listPulses
//
// List pulses in a thread.
//
// Pulses are returned in ascending chronological order with `(created, id)`
// as a stable tiebreaker for the cursor.
//
// Responses:
// 200: pulseListPulsesResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
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
	s.populateAuthorDisplay(c.Req.Context(), res.Items)
	return response.JSON(http.StatusOK, res)
}

// populateAuthorDisplay resolves user names/logins/avatar URLs for the
// pulse rows in place. We do a single ListByIdOrUID call per page so the
// cost is one query per listing, not one per pulse. Errors are swallowed:
// missing display names degrade to "User #<id>" on the frontend, which
// is the pre-existing behavior.
func (s *PulseService) populateAuthorDisplay(ctx context.Context, pulses []Pulse) {
	if len(pulses) == 0 || s.userSvc == nil {
		return
	}
	ids := make([]int64, 0, len(pulses))
	seen := make(map[int64]bool, len(pulses))
	for _, p := range pulses {
		if p.AuthorUserID <= 0 || seen[p.AuthorUserID] {
			continue
		}
		seen[p.AuthorUserID] = true
		ids = append(ids, p.AuthorUserID)
	}
	if len(ids) == 0 {
		return
	}
	users, err := s.userSvc.ListByIdOrUID(ctx, nil, ids)
	if err != nil {
		s.log.Warn("failed to resolve pulse authors", "err", err)
		return
	}
	type displayInfo struct {
		name, login, avatarURL string
	}
	by := make(map[int64]displayInfo, len(users))
	for _, u := range users {
		if u == nil {
			continue
		}
		by[u.ID] = displayInfo{
			name:      u.Name,
			login:     u.Login,
			avatarURL: gravatarAvatarURL(u.Email),
		}
	}
	for i := range pulses {
		d, ok := by[pulses[i].AuthorUserID]
		if !ok {
			continue
		}
		pulses[i].AuthorName = d.name
		pulses[i].AuthorLogin = d.login
		pulses[i].AuthorAvatarURL = d.avatarURL
	}
}

// gravatarAvatarURL returns the relative URL Grafana serves user avatars
// from. The route is `/avatar/<sha256(lowercased email)>` (matches the
// existing rule in pkg/api/dtos/models.go GetGravatarUrl). We compute it
// here rather than importing dtos to keep the pulse package independent
// of *setting.Cfg, and because the only thing GetGravatarUrl does on top
// of this is prepend the AppSubURL prefix — which is empty in our local
// dev setup and which the frontend already handles when needed.
func gravatarAvatarURL(email string) string {
	trimmed := strings.TrimSpace(email)
	if trimmed == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(strings.ToLower(trimmed)))
	return fmt.Sprintf("/avatar/%x", sum[:])
}

// swagger:route POST /pulse/threads/{threadUID}/pulses pulse alpha addPulse
//
// Add a reply to an existing thread.
//
// Replying to a soft-deleted parent pulse returns 409. Replying to a closed
// thread returns 409.
//
// Responses:
// 200: pulseAddPulseResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 409: conflictError
// 500: internalServerError
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
	one := []Pulse{p}
	s.populateAuthorDisplay(c.Req.Context(), one)
	return response.JSON(http.StatusOK, one[0])
}

// swagger:route PATCH /pulse/pulses/{pulseUID} pulse alpha editPulse
//
// Edit the body of a pulse.
//
// Only the original author may edit. Edits set `edited=true` and bump the
// thread version so other clients can re-render.
//
// Responses:
// 200: pulseEditPulseResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 410: goneError
// 500: internalServerError
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
	one := []Pulse{p}
	s.populateAuthorDisplay(c.Req.Context(), one)
	return response.JSON(http.StatusOK, one[0])
}

// swagger:route DELETE /pulse/threads/{threadUID} pulse alpha deleteThread
//
// Delete a pulse thread.
//
// Authorisation: thread author or `pulse:admin`. Deletes the thread and all
// of its pulses, mention rows, subscriptions, and read-state markers.
//
// Responses:
// 200: pulseGenericResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *PulseService) deleteThreadHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	t, err := s.GetThread(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapPulseError(err, "Failed to get thread")
	}
	if err := s.assertCanReadResource(c, t.ResourceKind, t.ResourceUID); err != nil {
		return err
	}
	cmd := DeleteThreadCommand{
		OrgID:   c.GetOrgID(),
		UID:     uid,
		UserID:  s.actorUserID(c),
		IsAdmin: c.SignedInUser != nil && c.HasRole("Admin"),
	}
	if err := s.DeleteThread(c.Req.Context(), cmd); err != nil {
		return mapPulseError(err, "Failed to delete thread")
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Thread deleted"})
}

// swagger:route POST /pulse/threads/{threadUID}/close pulse alpha closeThread
//
// Close a pulse thread.
//
// Closed threads are read-only — replies, edits and deletes return 409.
// Authorisation: thread author or `pulse:admin`.
//
// Responses:
// 200: pulseGetThreadResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 409: conflictError
// 500: internalServerError
func (s *PulseService) closeThreadHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	t, err := s.GetThread(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapPulseError(err, "Failed to get thread")
	}
	if err := s.assertCanReadResource(c, t.ResourceKind, t.ResourceUID); err != nil {
		return err
	}
	cmd := CloseThreadCommand{
		OrgID:   c.GetOrgID(),
		UID:     uid,
		UserID:  s.actorUserID(c),
		IsAdmin: c.SignedInUser != nil && c.HasRole("Admin"),
	}
	out, err := s.CloseThread(c.Req.Context(), cmd)
	if err != nil {
		return mapPulseError(err, "Failed to close thread")
	}
	return response.JSON(http.StatusOK, out)
}

// swagger:route POST /pulse/threads/{threadUID}/reopen pulse alpha reopenThread
//
// Reopen a closed thread.
//
// Authorisation: `pulse:admin` only by design — closing is a soft moderation
// signal that admins can override; the original author cannot reopen.
//
// Responses:
// 200: pulseGetThreadResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 409: conflictError
// 500: internalServerError
func (s *PulseService) reopenThreadHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	t, err := s.GetThread(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapPulseError(err, "Failed to get thread")
	}
	if err := s.assertCanReadResource(c, t.ResourceKind, t.ResourceUID); err != nil {
		return err
	}
	cmd := ReopenThreadCommand{
		OrgID:   c.GetOrgID(),
		UID:     uid,
		UserID:  s.actorUserID(c),
		IsAdmin: c.SignedInUser != nil && c.HasRole("Admin"),
	}
	out, err := s.ReopenThread(c.Req.Context(), cmd)
	if err != nil {
		return mapPulseError(err, "Failed to reopen thread")
	}
	return response.JSON(http.StatusOK, out)
}

// swagger:route DELETE /pulse/pulses/{pulseUID} pulse alpha deletePulse
//
// Soft-delete a pulse.
//
// The pulse row is retained for audit but the body is no longer returned
// by list endpoints. Authorisation: pulse author or `pulse:admin`.
//
// Responses:
// 200: pulseGenericResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 410: goneError
// 500: internalServerError
func (s *PulseService) deletePulseHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":pulseUID"]
	cmd := DeletePulseCommand{
		OrgID:   c.GetOrgID(),
		UID:     uid,
		UserID:  s.actorUserID(c),
		IsAdmin: c.SignedInUser != nil && c.HasRole("Admin"),
	}
	if err := s.DeletePulse(c.Req.Context(), cmd); err != nil {
		return mapPulseError(err, "Failed to delete pulse")
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Pulse deleted"})
}

// swagger:route POST /pulse/threads/{threadUID}/subscribe pulse alpha subscribeThread
//
// Subscribe the caller to thread notifications.
//
// Subscribers receive a notification on every new pulse on the thread.
// Authors are auto-subscribed when they create a thread or post a reply.
//
// Responses:
// 200: pulseGenericResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *PulseService) subscribeHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	t, err := s.GetThread(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapPulseError(err, "Failed to get thread")
	}
	if err := s.assertCanReadResource(c, t.ResourceKind, t.ResourceUID); err != nil {
		return err
	}
	if err := s.Subscribe(c.Req.Context(), SubscribeCommand{
		OrgID:     c.GetOrgID(),
		ThreadUID: uid,
		UserID:    s.actorUserID(c),
	}); err != nil {
		return mapPulseError(err, "Failed to subscribe")
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Subscribed"})
}

// swagger:route POST /pulse/threads/{threadUID}/unsubscribe pulse alpha unsubscribeThread
//
// Unsubscribe the caller from thread notifications.
//
// Responses:
// 200: pulseGenericResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *PulseService) unsubscribeHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	t, err := s.GetThread(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapPulseError(err, "Failed to get thread")
	}
	if err := s.assertCanReadResource(c, t.ResourceKind, t.ResourceUID); err != nil {
		return err
	}
	if err := s.Unsubscribe(c.Req.Context(), SubscribeCommand{
		OrgID:     c.GetOrgID(),
		ThreadUID: uid,
		UserID:    s.actorUserID(c),
	}); err != nil {
		return mapPulseError(err, "Failed to unsubscribe")
	}
	return response.JSON(http.StatusOK, map[string]string{"message": "Unsubscribed"})
}

// swagger:route POST /pulse/threads/{threadUID}/read pulse alpha markThreadRead
//
// Update the caller's per-thread read state.
//
// The body must include `lastReadPulseUID`. Used by the UI to compute
// unread badges. The endpoint is idempotent.
//
// Responses:
// 200: pulseGenericResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *PulseService) markReadHandler(c *contextmodel.ReqContext) response.Response {
	uid := web.Params(c.Req)[":threadUID"]
	t, err := s.GetThread(c.Req.Context(), c.GetOrgID(), uid)
	if err != nil {
		return mapPulseError(err, "Failed to get thread")
	}
	if err := s.assertCanReadResource(c, t.ResourceKind, t.ResourceUID); err != nil {
		return err
	}
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

// swagger:route GET /pulse/resources/{kind}/{uid}/version pulse alpha getResourceVersion
//
// Get the current pulse activity version for a resource.
//
// The version is a monotonic counter that increments on any pulse activity
// for the resource. Frontends poll this as a fallback when Grafana Live is
// unreachable.
//
// Responses:
// 200: pulseResourceVersionResponse
// 400: badRequestError
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
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
		errors.Is(err, ErrCannotDeleteThreadForbidden),
		errors.Is(err, ErrCannotCloseThreadForbidden),
		errors.Is(err, ErrCannotReopenThreadForbidden),
		errors.Is(err, ErrAccessDenied):
		return response.Error(http.StatusForbidden, err.Error(), err)
	case errors.Is(err, ErrPulseAlreadyDeleted):
		return response.Error(http.StatusGone, err.Error(), err)
	case errors.Is(err, ErrThreadClosed),
		errors.Is(err, ErrThreadAlreadyClosed),
		errors.Is(err, ErrThreadNotClosed):
		return response.Error(http.StatusConflict, err.Error(), err)
	default:
		return response.Error(http.StatusInternalServerError, defaultMsg, err)
	}
}

// swagger:response pulseCreateThreadResponse
type PulseCreateThreadResponse struct {
	// in: body
	Body CreateThreadResult `json:"body"`
}

// PulseThreadPage is the swagger-friendly mirror of PageResult[Thread].
// go-swagger 0.30.6 does not understand Go generics (it panics on the
// type parameter), so we hand-write concrete envelopes for each
// response type. The JSON wire format is identical to PageResult[T]
// because the field tags line up one-for-one.
//
// swagger:model
type PulseThreadPage struct {
	Items      []Thread `json:"items"`
	NextCursor string   `json:"nextCursor,omitempty"`
	HasMore    bool     `json:"hasMore"`
	Page       int      `json:"page,omitempty"`
	TotalCount int64    `json:"totalCount,omitempty"`
}

// swagger:response pulseListThreadsResponse
type PulseListThreadsResponse struct {
	// in: body
	Body PulseThreadPage `json:"body"`
}

// swagger:response pulseGetThreadResponse
type PulseGetThreadResponse struct {
	// in: body
	Body Thread `json:"body"`
}

// PulsePulsePage is the swagger-friendly mirror of PageResult[Pulse].
// See PulseThreadPage for why generics don't work in swagger annotations.
//
// swagger:model
type PulsePulsePage struct {
	Items      []Pulse `json:"items"`
	NextCursor string  `json:"nextCursor,omitempty"`
	HasMore    bool    `json:"hasMore"`
	Page       int     `json:"page,omitempty"`
	TotalCount int64   `json:"totalCount,omitempty"`
}

// swagger:response pulseListPulsesResponse
type PulseListPulsesResponse struct {
	// in: body
	Body PulsePulsePage `json:"body"`
}

// swagger:response pulseAddPulseResponse
type PulseAddPulseResponse struct {
	// in: body
	Body Pulse `json:"body"`
}

// swagger:response pulseEditPulseResponse
type PulseEditPulseResponse struct {
	// in: body
	Body Pulse `json:"body"`
}

// swagger:response pulseGenericResponse
type PulseGenericResponse struct {
	// in: body
	Body struct {
		Message string `json:"message"`
	} `json:"body"`
}

// swagger:response pulseResourceVersionResponse
type PulseResourceVersionResponse struct {
	// in: body
	Body ResourceVersion `json:"body"`
}
