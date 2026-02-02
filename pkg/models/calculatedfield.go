/*
 * Copyright (C) 2021-2025 BMC Helix Inc
 * Added by abhasin at 03/08/2021
 */

package models

import (
	"errors"
)

// Typed errors
var (
	DuplicateFieldName = errors.New("duplicate field")
)

type CalculatedField struct {
	FormName    string `xorm:"form_name"`
	Module      string `xorm:"module"`
	Name        string `xorm:"name"`
	SqlQuery    string `xorm:"sql_query"`
	Aggregation bool   `xorm:"aggregation"`
}

type GetCalculatedField struct {
	OrgId  int64
	Result []*CalculatedField
}
