package models

import "github.com/grafana/grafana/pkg/services/user"

type SetUserHelpFlagCommand struct {
	HelpFlags1 user.HelpFlags1
	UserId     int64
}
