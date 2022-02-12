package models

import "time"

type RenderUser struct {
	OrgID   int64
	UserID  int64
	OrgRole string
}

type FindRenderUserQuery struct {
	RenderKey string
	MaxAge    time.Duration

	Result *RenderUser
}

type FindAndRefreshRenderKeyCommand struct {
	RenderUser RenderUser
	MaxAge     time.Duration

	Result *string
}

type SaveRenderKeyCommand struct {
	RenderUser RenderUser
	RenderKey  string

	Result *int64
}
