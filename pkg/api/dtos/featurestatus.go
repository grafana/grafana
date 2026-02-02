/*
 * Copyright (C) 2022-2025 BMC Helix Inc
 * Added by ymulthan at 4/12/2022
 */

package dtos

type FeatureStatus struct {
	FeatureName string `json:"featureName"`
	Status      bool   `json:"status"`
	OrgId       int64  `json:"orgId"`
	Id          int64  `json:"id"`
}
