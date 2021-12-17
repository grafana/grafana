package dtos

import "time"

// ----------------------
// QUERIES

type GetOrgUsersQuery struct {
	OrgId int64
	Query string
	Limit int

	Result []*OrgUserDTO
}

type SearchOrgUsersQuery struct {
	OrgID int64
	Query string
	Page  int
	Limit int

	Result SearchOrgUsersQueryResult
}

type SearchOrgUsersQueryResult struct {
	TotalCount int64         `json:"totalCount"`
	OrgUsers   []*OrgUserDTO `json:"OrgUsers"`
	Page       int           `json:"page"`
	PerPage    int           `json:"perPage"`
}

// ----------------------
// Projections and DTOs

type OrgUserDTO struct {
	OrgId         int64     `json:"orgId"`
	UserId        int64     `json:"userId"`
	Email         string    `json:"email"`
	Name          string    `json:"name"`
	AvatarUrl     string    `json:"avatarUrl"`
	Login         string    `json:"login"`
	Role          string    `json:"role"`
	LastSeenAt    time.Time `json:"lastSeenAt"`
	LastSeenAtAge string    `json:"lastSeenAtAge"`
}
