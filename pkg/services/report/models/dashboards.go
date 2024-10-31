package models

import (
	"bytes"
	"encoding/json"
	"strings"
	"time"
)

type ReportDashboard struct {
	ID              int64           `xorm:"'id' autoincr pk"`
	ReportID        int64           `xorm:"report_id"`
	DashboardUID    string          `xorm:"dashboard_uid"`
	ReportVariables json.RawMessage `xorm:"report_variables"`
	TimeFrom        string
	TimeTo          string
	Created         time.Time
}

func (ReportDashboard) TableName() string {
	return "report_dashboards"
}

// UnmarshallDeprecatedVars handles deprecated report variables that are a map of comma-separated strings
func (rd ReportDashboard) UnmarshallDeprecatedVars() (map[string][]string, error) {
	var deprecatedReportVars map[string]string
	err := json.Unmarshal(rd.ReportVariables, &deprecatedReportVars)
	if err != nil {
		return nil, err
	}

	res := make(map[string][]string, len(deprecatedReportVars))
	for k, v := range deprecatedReportVars {
		res[k] = strings.Split(v, ",")
	}

	return res, nil
}

// GetFixedDeprecatedVars returns template variables that are a map of comma-separated strings as a JSON map of string arrays
func (rd ReportDashboard) GetFixedDeprecatedVars() []byte {
	if len(rd.ReportVariables) <= 0 || bytes.Equal(rd.ReportVariables, []byte("{}")) {
		return nil
	}

	vars, err := rd.UnmarshallDeprecatedVars()
	if err != nil {
		return nil
	}

	jsonVars, err := json.Marshal(vars)
	if err != nil {
		return nil
	}

	return jsonVars
}
