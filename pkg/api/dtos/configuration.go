/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by kmejdi at 29/7/2021
 */

package dtos

type CustomConfiguration struct {
	DocLink       string `json:"docLink"`
	SupportLink   string `json:"supportLink"`
	CommunityLink string `json:"communityLink"`
	VideoLink     string `json:"videoLink"`
	QueryType     string `json:"queryType"`
}
