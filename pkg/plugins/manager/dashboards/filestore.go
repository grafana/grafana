package dashboards

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
)

var _ FileStore = (*FileStoreManager)(nil)

type FileStoreManager struct {
	pluginStore     plugins.Store
	pluginFileStore plugins.FileStore
}

func ProvideFileStoreManager(pluginStore plugins.Store, pluginFileStore plugins.FileStore) *FileStoreManager {
	return &FileStoreManager{
		pluginStore:     pluginStore,
		pluginFileStore: pluginFileStore,
	}
}

var openDashboardFile = func(ctx context.Context, pluginFileStore plugins.FileStore, pluginID, name string) (*plugins.File, error) {
	f, err := pluginFileStore.File(ctx, pluginID, name)
	if err != nil {
		return &plugins.File{}, err
	}

	return f, nil
}

func (m *FileStoreManager) ListPluginDashboardFiles(ctx context.Context, args *ListPluginDashboardFilesArgs) (*ListPluginDashboardFilesResult, error) {
	if args == nil {
		return nil, fmt.Errorf("args cannot be nil")
	}

	if len(strings.TrimSpace(args.PluginID)) == 0 {
		return nil, fmt.Errorf("args.PluginID cannot be empty")
	}

	plugin, exists := m.pluginStore.Plugin(ctx, args.PluginID)
	if !exists {
		return nil, plugins.NotFoundError{PluginID: args.PluginID}
	}

	references := []string{}
	for _, include := range plugin.DashboardIncludes() {
		references = append(references, include.Path)
	}

	return &ListPluginDashboardFilesResult{
		FileReferences: references,
	}, nil
}

func (m *FileStoreManager) GetPluginDashboardFileContents(ctx context.Context, args *GetPluginDashboardFileContentsArgs) (*GetPluginDashboardFileContentsResult, error) {
	if args == nil {
		return nil, fmt.Errorf("args cannot be nil")
	}

	if len(strings.TrimSpace(args.PluginID)) == 0 {
		return nil, fmt.Errorf("args.PluginID cannot be empty")
	}

	if len(strings.TrimSpace(args.FileReference)) == 0 {
		return nil, fmt.Errorf("args.FileReference cannot be empty")
	}

	plugin, exists := m.pluginStore.Plugin(ctx, args.PluginID)
	if !exists {
		return nil, plugins.NotFoundError{PluginID: args.PluginID}
	}

	var includedFile *plugins.Includes
	for _, include := range plugin.DashboardIncludes() {
		if args.FileReference == include.Path {
			includedFile = include
			break
		}
	}

	if includedFile == nil {
		return nil, fmt.Errorf("plugin dashboard file not found")
	}

	cleanPath, err := util.CleanRelativePath(includedFile.Path)
	if err != nil {
		// CleanRelativePath should clean and make the path relative so this is not expected to fail
		return nil, err
	}

	file, err := openDashboardFile(ctx, m.pluginFileStore, plugin.ID, cleanPath)
	if err != nil {
		return nil, err
	}

	return &GetPluginDashboardFileContentsResult{
		Content: file.Content,
	}, nil
}
