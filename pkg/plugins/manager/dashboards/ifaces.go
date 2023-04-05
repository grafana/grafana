package dashboards

import (
	"context"
)

// FileStore is the interface for plugin dashboard file storage.
type FileStore interface {
	// ListPluginDashboardFiles lists plugin dashboard files.
	ListPluginDashboardFiles(ctx context.Context, args *ListPluginDashboardFilesArgs) (*ListPluginDashboardFilesResult, error)
	// GetPluginDashboardFileContents gets the referenced plugin dashboard file content.
	GetPluginDashboardFileContents(ctx context.Context, args *GetPluginDashboardFileContentsArgs) (*GetPluginDashboardFileContentsResult, error)
}

// ListPluginDashboardFilesArgs list plugin dashboard files argument model.
type ListPluginDashboardFilesArgs struct {
	PluginID string
}

// ListPluginDashboardFilesResult list plugin dashboard files result model.
type ListPluginDashboardFilesResult struct {
	FileReferences []string
}

// GetPluginDashboardFileContentsArgs get plugin dashboard file content argument model.
type GetPluginDashboardFileContentsArgs struct {
	PluginID      string
	FileReference string
}

// GetPluginDashboardFileContentsResult get plugin dashboard file content result model.
type GetPluginDashboardFileContentsResult struct {
	Content []byte
}
