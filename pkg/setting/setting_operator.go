package setting

import (
	"gopkg.in/ini.v1"
)

type OperatorSettings struct {
	Name string
}

func readOperatorSettings(iniFile *ini.File) OperatorSettings {
	s := OperatorSettings{}
	s.Name = valueAsString(iniFile.Section("operator"), "name", "")
	return s
}
