package setting

import (
	"gopkg.in/ini.v1"
)

type FolderSettings struct {
	// AbsoluteMaxNestedFolderDepth is the hard ceiling for folder nesting depth.
	// The SQL query builders use this value to generate JOIN chains, so it must
	// be at least as large as any value that can be configured.
	AbsoluteMaxNestedFolderDepth int

	// MaxNestedFolderDepth is the configured maximum nesting depth for folders.
	// Must be between 1 and AbsoluteMaxNestedFolderDepth (7).
	MaxNestedFolderDepth int
}

func readFolderSettings(iniFile *ini.File) FolderSettings {
	s := FolderSettings{}
	s.AbsoluteMaxNestedFolderDepth = 7

	folderSection := iniFile.Section("folder")
	s.MaxNestedFolderDepth = folderSection.Key("max_nested_folder_depth").MustInt(4)
	if s.MaxNestedFolderDepth > s.AbsoluteMaxNestedFolderDepth {
		s.MaxNestedFolderDepth = s.AbsoluteMaxNestedFolderDepth
	}
	if s.MaxNestedFolderDepth < 1 {
		s.MaxNestedFolderDepth = 1
	}
	return s
}
