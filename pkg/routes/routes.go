package routes

import "github.com/torkelo/grafana-pro/pkg/setting"

func GlobalInit() {
	setting.NewConfigContext()
}
