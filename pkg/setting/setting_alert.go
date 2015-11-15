package setting

type AlertSettings struct {
	Url        string
}

func readAlertSettings() {
	alert := Cfg.Section("alert")
  Alert.Url = alert.Key("alert_url").String()
}
