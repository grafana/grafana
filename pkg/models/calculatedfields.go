/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by ateli at 10/02/2022
 */

package models

type CalculatedFields struct {
	Id          int64  `json:"fieldId"`
	FormName    string `json:"formName"`
	Module      string `json:"module"`
	Name        string `json:"name"`
	SqlQuery    string `json:"sqlQuery"`
	FieldType   string `json:"field_type"`
	Aggregation bool   `json:"Aggregation"`
}

type CreateCalcFieldCmd struct {
	OrgId       int64  `json:"OrgId"`
	FormName    string `json:"formName" binding:"Required"`
	Module      string `json:"module" binding:"Required"`
	Name        string `json:"name" binding:"Required"`
	SqlQuery    string `json:"sqlQuery" binding:"Required"`
	Aggregation bool   `json:"Aggregation"`
}

type DeleteCalcFieldsByIds struct {
	Ids   []int64
	OrgId int64
}

type CalcFieldIdsDTO struct {
	Ids []int64 `json:"ids"`
}

type GetCalculatedFields struct {
	OrgId  int64
	Result []*CalculatedFields
}

type ModifyCalcFieldCmd struct {
	Id          int64  `json:"fieldId"`
	OrgId       int64  `json:"OrgId"`
	FormName    string `json:"formName" binding:"Required"`
	Module      string `json:"module" binding:"Required"`
	Name        string `json:"name" binding:"Required"`
	SqlQuery    string `json:"sqlQuery" binding:"Required"`
	Aggregation bool   `json:"Aggregation"`
}

type DashboardsToBeUpdated struct {
	DashboardId int64
	OrgId       int64
	Result      []*DashboardsToBeUpdatedDTO
}

type DashboardsToBeUpdatedDTO struct {
	DashboardId   int64  `xorm:"id"`
	DashboardData string `xorm:"data"`
}

type DashboardsToBeDeletedDTO struct {
	FieldNames string `xorm:"name"`
}

type DashboardUpdateCommand struct {
	DashboardData string `xorm:"data"`
}
