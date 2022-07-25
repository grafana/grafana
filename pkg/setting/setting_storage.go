package setting

import (
	"gopkg.in/ini.v1"
)

type StorageSettings struct {
	AllowUnsanitizedSvgUpload bool
}

func readStorageSettings(iniFile *ini.File) StorageSettings {
	s := StorageSettings{}
	storageSection := iniFile.Section("storage")
	s.AllowUnsanitizedSvgUpload = storageSection.Key("allow_unsanitized_svg_upload").MustBool(false)
	return s
}
