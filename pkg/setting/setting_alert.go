package setting

type AlertSettings struct {
	AlertUrlRoot string
}

func readAlertSettings() {
	alert := Cfg.Section("alert")
  Alert.AlertUrlRoot = alert.Key("alert_urlroot").String()
}
