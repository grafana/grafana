package setting

import (
	"gopkg.in/ini.v1"
)

const absoluteMaxNestedFolderDepth = 7

type FolderSettings struct {
	// MaxNestedFolderDepth is the configured maximum nesting depth for folders.
	// Must be between 1 and absoluteMaxNestedFolderDepth (7).
	MaxNestedFolderDepth int
}

func readFolderSettings(iniFile *ini.File) FolderSettings {
	s := FolderSettings{}

	folderSection := iniFile.Section("folder")
	s.MaxNestedFolderDepth = folderSection.Key("max_nested_folder_depth").MustInt(4)
	if s.MaxNestedFolderDepth > absoluteMaxNestedFolderDepth {
		s.MaxNestedFolderDepth = absoluteMaxNestedFolderDepth
	}
	if s.MaxNestedFolderDepth < 1 {
		s.MaxNestedFolderDepth = 1
	}
	return s
}
