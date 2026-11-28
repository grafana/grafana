package setting

import "gopkg.in/ini.v1"

type MeticulousSettings struct {
	Enabled        bool
	Production     bool
	RecordingToken string
}

func (cfg *Cfg) readMeticulousSettings(file *ini.File) {
	section := file.Section("meticulous")
	cfg.Meticulous = MeticulousSettings{
		Enabled:        section.Key("enabled").MustBool(false),
		Production:     section.Key("production").MustBool(true),
		RecordingToken: section.Key("recording_token").String(),
	}
}
