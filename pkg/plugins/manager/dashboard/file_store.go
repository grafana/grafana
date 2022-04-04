package dashboard

import (
	"context"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/util"
)

var _ plugins.DashboardFileStore = (*FileStoreManager)(nil)

type FileStoreManager struct {
	pluginRegistry registry.Service
}

func ProvideFileStoreManager(pluginRegistry registry.Service) *FileStoreManager {
	return &FileStoreManager{
		pluginRegistry: pluginRegistry,
	}
}

var openDashboardFile = func(name string) (fs.File, error) {
	// Wrapping in filepath.Clean to properly handle
	// gosec G304 Potential file inclusion via variable rule.
	return os.Open(filepath.Clean(name))
}

func (m *FileStoreManager) ListPluginDashboardFiles(ctx context.Context, args *plugins.ListPluginDashboardFilesArgs) (*plugins.ListPluginDashboardFilesResult, error) {
	if args == nil {
		return nil, fmt.Errorf("args cannot be nil")
	}

	if len(strings.TrimSpace(args.PluginID)) == 0 {
		return nil, fmt.Errorf("args.PluginID cannot be empty")
	}

	plugin, exists := m.plugin(ctx, args.PluginID)
	if !exists {
		return nil, plugins.NotFoundError{PluginID: args.PluginID}
	}

	references := []string{}
	for _, include := range plugin.DashboardIncludes() {
		references = append(references, include.Path)
	}

	return &plugins.ListPluginDashboardFilesResult{
		FileReferences: references,
	}, nil
}

func (m *FileStoreManager) GetPluginDashboardFileContents(ctx context.Context, args *plugins.GetPluginDashboardFileContentsArgs) (*plugins.GetPluginDashboardFileContentsResult, error) {
	if args == nil {
		return nil, fmt.Errorf("args cannot be nil")
	}

	if len(strings.TrimSpace(args.PluginID)) == 0 {
		return nil, fmt.Errorf("args.PluginID cannot be empty")
	}

	if len(strings.TrimSpace(args.FileReference)) == 0 {
		return nil, fmt.Errorf("args.FileReference cannot be empty")
	}

	plugin, exists := m.plugin(ctx, args.PluginID)
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

	dashboardFilePath := filepath.Join(plugin.PluginDir, cleanPath)
	file, err := openDashboardFile(dashboardFilePath)
	if err != nil {
		return nil, err
	}

	return &plugins.GetPluginDashboardFileContentsResult{
		Content: file,
	}, nil
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (m *FileStoreManager) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return nil, false
	}

	if p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}
