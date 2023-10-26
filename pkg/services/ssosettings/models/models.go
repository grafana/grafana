package models

import "time"

type SSOSetting struct {
	ID        string                 `xorm:"id pk"`
	Provider  string                 `xorm:"provider"`
	Settings  map[string]interface{} `xorm:"settings"`
	Created   time.Time              `xorm:"created"`
	Updated   time.Time              `xorm:"updated"`
	IsDeleted bool                   `xorm:"is_deleted"`
}
