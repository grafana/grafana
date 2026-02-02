/*
 * Copyright (C) 2022-2025 BMC Helix Inc
 * Added by ymulthan at 4/12/2022
 */

package models

type FeatureStatus struct {
	FeatureName string `xorm:"feature_name" db:"feature_name" json:"featureName"`
	Status      bool   `xorm:"status" db:"status" json:"status"`
	OrgId       int64  `xorm:"org_id" db:"org_id" json:"orgId"`
	Id          int64  `json:"id"`
}

type GetFeatureStatus struct {
	OrgId  int64
	Result []*FeatureStatus
}

type SetFeatureStatus struct {
	OrgId int64
	Data  FeatureStatus `xorm:"extends"`
}

type RefreshFeatureStatus struct {
	OrgId int64
}
