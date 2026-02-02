/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by kmejdi at 29/7/2021
 */

package models

type CustomConfiguration struct {
	OrgID         int64  `xorm:"org_id" db:"org_id"`
	DocLink       string `xorm:"doc_link" db:"doc_link"`
	SupportLink   string `xorm:"support_link" db:"support_link"`
	CommunityLink string `xorm:"community_link" db:"community_link"`
	VideoLink     string `xorm:"video_link" db:"video_link"`
	QueryType     string `xorm:"query_type" db:"query_type"`
}

type GetCustomConfiguration struct {
	OrgId  int64
	Result *CustomConfiguration
}

type SetCustomConfiguration struct {
	OrgId int64
	Data  CustomConfiguration `xorm:"extends"`
}

type RefreshCustomConfiguration struct {
	OrgId int64
}
