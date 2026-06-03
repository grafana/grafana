package api

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/dashboardcomments"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

type commentUserDTO struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatarUrl"`
}

type commentMessageDTO struct {
	ID        int64          `json:"id"`
	ThreadID  int64          `json:"threadId"`
	Author    commentUserDTO `json:"author"`
	Body      string         `json:"body"`
	CreatedAt string         `json:"createdAt"`
}

type commentAnchorDTO struct {
	PanelKey string  `json:"panelKey"`
	XNorm    float64 `json:"xNorm"`
	YNorm    float64 `json:"yNorm"`
}

type commentContextDTO struct {
	PanelTitle string              `json:"panelTitle"`
	TimeRange  map[string]string   `json:"timeRange"`
}

type commentThreadDTO struct {
	ID           int64               `json:"id"`
	DashboardUID string              `json:"dashboardUid"`
	Anchor       commentAnchorDTO    `json:"anchor"`
	Context      commentContextDTO   `json:"context"`
	Resolved     bool                `json:"resolved"`
	CreatedBy    commentUserDTO      `json:"createdBy"`
	CreatedAt    string              `json:"createdAt"`
	Messages     []commentMessageDTO `json:"messages"`
}

type createThreadBody struct {
	Anchor      commentAnchorDTO  `json:"anchor"`
	Context     commentContextDTO `json:"context"`
	InitialBody string            `json:"body"`
}

type updateThreadBody struct {
	Resolved *bool `json:"resolved,omitempty"`
}

type addMessageBody struct {
	Body string `json:"body"`
}

func (hs *HTTPServer) getDashboardUIDFromPath(c *contextmodel.ReqContext) (string, response.Response) {
	uid := web.Params(c.Req)[":uid"]
	if uid == "" {
		return "", response.Error(http.StatusBadRequest, "Invalid dashboard UID", nil)
	}
	return uid, nil
}

func (hs *HTTPServer) parseThreadID(c *contextmodel.ReqContext) (int64, response.Response) {
	raw := web.Params(c.Req)[":id"]
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, response.Error(http.StatusBadRequest, "Invalid thread id", err)
	}
	return id, nil
}

func (hs *HTTPServer) userDTO(ctx *contextmodel.ReqContext, userID int64) commentUserDTO {
	if userID == 0 {
		return commentUserDTO{}
	}
	u, err := hs.userService.GetByID(ctx.Req.Context(), &user.GetUserByIDQuery{ID: userID})
	if err != nil || u == nil {
		return commentUserDTO{ID: userID}
	}
	return commentUserDTO{
		ID:        u.ID,
		Name:      firstNonEmpty(u.Name, u.Login, u.Email),
		AvatarURL: dtos.GetGravatarUrl(hs.Cfg, u.Email),
	}
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func (hs *HTTPServer) toThreadDTO(c *contextmodel.ReqContext, t *dashboardcomments.Thread) commentThreadDTO {
	msgs := make([]commentMessageDTO, 0, len(t.Messages))
	for _, m := range t.Messages {
		msgs = append(msgs, commentMessageDTO{
			ID:        m.ID,
			ThreadID:  m.ThreadID,
			Author:    hs.userDTO(c, m.AuthorUserID),
			Body:      m.Body,
			CreatedAt: m.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		})
	}
	return commentThreadDTO{
		ID:           t.ID,
		DashboardUID: t.DashboardUID,
		Anchor: commentAnchorDTO{
			PanelKey: t.AnchorPanelKey,
			XNorm:    t.AnchorXNorm,
			YNorm:    t.AnchorYNorm,
		},
		Context: commentContextDTO{
			PanelTitle: t.ContextPanelTitle,
			TimeRange: map[string]string{
				"from": t.ContextTimeFrom,
				"to":   t.ContextTimeTo,
			},
		},
		Resolved:  t.Resolved,
		CreatedBy: hs.userDTO(c, t.CreatedByUserID),
		CreatedAt: t.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
		Messages:  msgs,
	}
}

func (hs *HTTPServer) commentErrorResponse(err error) response.Response {
	switch {
	case errors.Is(err, dashboardcomments.ErrThreadNotFound), errors.Is(err, dashboardcomments.ErrMessageNotFound):
		return response.Error(http.StatusNotFound, err.Error(), err)
	case errors.Is(err, dashboardcomments.ErrValidationFailed), errors.Is(err, dashboardcomments.ErrEmptyBody):
		return response.Error(http.StatusBadRequest, err.Error(), err)
	case errors.Is(err, dashboardcomments.ErrForbidden):
		return response.Error(http.StatusForbidden, err.Error(), err)
	default:
		return response.Error(http.StatusInternalServerError, "comment operation failed", err)
	}
}

// GET /api/dashboards/uid/:uid/comments
func (hs *HTTPServer) ListDashboardComments(c *contextmodel.ReqContext) response.Response {
	uid, errResp := hs.getDashboardUIDFromPath(c)
	if errResp != nil {
		return errResp
	}
	threads, err := hs.dashboardCommentsService.ListThreads(c.Req.Context(), &dashboardcomments.ListThreadsQuery{
		OrgID:        c.GetOrgID(),
		DashboardUID: uid,
	})
	if err != nil {
		return hs.commentErrorResponse(err)
	}
	out := make([]commentThreadDTO, 0, len(threads))
	for _, t := range threads {
		out = append(out, hs.toThreadDTO(c, t))
	}
	return response.JSON(http.StatusOK, map[string]any{"threads": out})
}

// POST /api/dashboards/uid/:uid/comments
func (hs *HTTPServer) CreateDashboardComment(c *contextmodel.ReqContext) response.Response {
	uid, errResp := hs.getDashboardUIDFromPath(c)
	if errResp != nil {
		return errResp
	}
	var body createThreadBody
	if err := web.Bind(c.Req, &body); err != nil {
		return response.Error(http.StatusBadRequest, "bad request", err)
	}
	thread, err := hs.dashboardCommentsService.CreateThread(c.Req.Context(), &dashboardcomments.CreateThreadCommand{
		OrgID:             c.GetOrgID(),
		DashboardUID:      uid,
		CreatedByUserID:   c.SignedInUser.UserID,
		AnchorPanelKey:    body.Anchor.PanelKey,
		AnchorXNorm:       body.Anchor.XNorm,
		AnchorYNorm:       body.Anchor.YNorm,
		ContextPanelTitle: body.Context.PanelTitle,
		ContextTimeFrom:   body.Context.TimeRange["from"],
		ContextTimeTo:     body.Context.TimeRange["to"],
		InitialBody:       body.InitialBody,
	})
	if err != nil {
		return hs.commentErrorResponse(err)
	}
	return response.JSON(http.StatusCreated, hs.toThreadDTO(c, thread))
}

// PATCH /api/dashboards/comments/threads/:id
func (hs *HTTPServer) UpdateDashboardCommentThread(c *contextmodel.ReqContext) response.Response {
	id, errResp := hs.parseThreadID(c)
	if errResp != nil {
		return errResp
	}
	var body updateThreadBody
	if err := web.Bind(c.Req, &body); err != nil {
		return response.Error(http.StatusBadRequest, "bad request", err)
	}
	updated, err := hs.dashboardCommentsService.UpdateThread(c.Req.Context(), &dashboardcomments.UpdateThreadCommand{
		OrgID:        c.GetOrgID(),
		ThreadID:     id,
		ActingUserID: c.SignedInUser.UserID,
		IsDashEditor: false,
		Resolved:     body.Resolved,
	})
	if err != nil {
		return hs.commentErrorResponse(err)
	}
	return response.JSON(http.StatusOK, hs.toThreadDTO(c, updated))
}

// DELETE /api/dashboards/comments/threads/:id
func (hs *HTTPServer) DeleteDashboardCommentThread(c *contextmodel.ReqContext) response.Response {
	id, errResp := hs.parseThreadID(c)
	if errResp != nil {
		return errResp
	}
	if err := hs.dashboardCommentsService.DeleteThread(c.Req.Context(), &dashboardcomments.DeleteThreadCommand{
		OrgID:        c.GetOrgID(),
		ThreadID:     id,
		ActingUserID: c.SignedInUser.UserID,
		IsDashEditor: false,
	}); err != nil {
		return hs.commentErrorResponse(err)
	}
	return response.Success("Thread deleted")
}

// POST /api/dashboards/comments/threads/:id/messages
func (hs *HTTPServer) AddDashboardCommentMessage(c *contextmodel.ReqContext) response.Response {
	id, errResp := hs.parseThreadID(c)
	if errResp != nil {
		return errResp
	}
	var body addMessageBody
	if err := web.Bind(c.Req, &body); err != nil {
		return response.Error(http.StatusBadRequest, "bad request", err)
	}
	msg, err := hs.dashboardCommentsService.AddMessage(c.Req.Context(), &dashboardcomments.AddMessageCommand{
		OrgID:        c.GetOrgID(),
		ThreadID:     id,
		AuthorUserID: c.SignedInUser.UserID,
		Body:         body.Body,
	})
	if err != nil {
		return hs.commentErrorResponse(err)
	}
	return response.JSON(http.StatusCreated, commentMessageDTO{
		ID:        msg.ID,
		ThreadID:  msg.ThreadID,
		Author:    hs.userDTO(c, msg.AuthorUserID),
		Body:      msg.Body,
		CreatedAt: msg.CreatedAt.UTC().Format("2006-01-02T15:04:05Z"),
	})
}

// DELETE /api/dashboards/comments/messages/:id
func (hs *HTTPServer) DeleteDashboardCommentMessage(c *contextmodel.ReqContext) response.Response {
	raw := web.Params(c.Req)[":id"]
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return response.Error(http.StatusBadRequest, "Invalid message id", err)
	}
	if err := hs.dashboardCommentsService.DeleteMessage(c.Req.Context(), &dashboardcomments.DeleteMessageCommand{
		OrgID:        c.GetOrgID(),
		MessageID:    id,
		ActingUserID: c.SignedInUser.UserID,
		IsDashEditor: false,
	}); err != nil {
		return hs.commentErrorResponse(err)
	}
	return response.Success("Message deleted")
}
