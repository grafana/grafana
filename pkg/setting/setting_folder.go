package setting

import (
	"fmt"
	"strconv"

	"gopkg.in/ini.v1"
)

const maxNestedFolderDepth = 7
const DefaultMaxNestedFolderDepth = 4

func maxDeptFolderSettings(iniFile *ini.File) int {
	if iniFile == nil {
		return DefaultMaxNestedFolderDepth
	}

	folderSection := iniFile.Section("folder")
	cfgMaxNestedFolderDepth := min(folderSection.Key("max_nested_folder_depth").MustInt(DefaultMaxNestedFolderDepth), maxNestedFolderDepth)

	if cfgMaxNestedFolderDepth <= 0 {
		cfgMaxNestedFolderDepth = DefaultMaxNestedFolderDepth
	}

	return cfgMaxNestedFolderDepth
}

// readFolderParallelDashboardDeleteSettings rejects malformed values instead of falling back to
// defaults, so a typo cannot silently change how folder deletion behaves.
func (cfg *Cfg) readFolderParallelDashboardDeleteSettings(folder *ini.Section) error {
	enabled, err := strconv.ParseBool(folder.Key("parallel_dashboard_delete_enabled").MustString("false"))
	if err != nil {
		return fmt.Errorf("folder.parallel_dashboard_delete_enabled must be a boolean: %w", err)
	}
	concurrency, err := strconv.Atoi(folder.Key("parallel_dashboard_delete_concurrency").MustString("4"))
	if err != nil || concurrency <= 0 {
		return fmt.Errorf("folder.parallel_dashboard_delete_concurrency must be a positive integer")
	}
	cfg.FolderParallelDashboardDeleteEnabled = enabled
	cfg.FolderParallelDashboardDeleteConcurrency = concurrency
	return nil
}
