package setting

import (
	"reflect"
)

type OrgQuota struct {
	User       int64 `target:"org_user"`
	DataSource int64 `target:"data_source"`
	Dashboard  int64 `target:"dashboard"`
	ApiKey     int64 `target:"api_key"`
	AlertRule  int64 `target:"alert_rule"`
}

type UserQuota struct {
	Org int64 `target:"org_user"`
}

type GlobalQuota struct {
	Org        int64 `target:"org"`
	User       int64 `target:"user"`
	DataSource int64 `target:"data_source"`
	Dashboard  int64 `target:"dashboard"`
	ApiKey     int64 `target:"api_key"`
	Session    int64 `target:"-"`
	AlertRule  int64 `target:"alert_rule"`
	File       int64 `target:"file"`
}

func (q *OrgQuota) ToMap() map[string]int64 {
	return quotaToMap(*q)
}

func (q *UserQuota) ToMap() map[string]int64 {
	return quotaToMap(*q)
}

func quotaToMap(q interface{}) map[string]int64 {
	qMap := make(map[string]int64)
	typ := reflect.TypeOf(q)
	val := reflect.ValueOf(q)

	for i := 0; i < typ.NumField(); i++ {
		field := typ.Field(i)
		name := field.Tag.Get("target")
		if name == "" {
			name = field.Name
		}
		if name == "-" {
			continue
		}
		value := val.Field(i)
		qMap[name] = value.Int()
	}
	return qMap
}
