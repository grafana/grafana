package setting

import (
	"gopkg.in/ini.v1"
)

const maxNestedFolderDepth = 7
const defaultMaxNestedFolderDepth = 4

func maxDeptFolderSettings(iniFile *ini.File) int {
	if iniFile == nil {
		return defaultMaxNestedFolderDepth
	}

	folderSection := iniFile.Section("folder")
	cfgMaxNestedFolderDepth := folderSection.Key("max_nested_folder_depth").MustInt(defaultMaxNestedFolderDepth)
	if cfgMaxNestedFolderDepth > maxNestedFolderDepth {
		cfgMaxNestedFolderDepth = maxNestedFolderDepth
	}

	if cfgMaxNestedFolderDepth <= 0 {
		cfgMaxNestedFolderDepth = defaultMaxNestedFolderDepth
	}

	return cfgMaxNestedFolderDepth
}
