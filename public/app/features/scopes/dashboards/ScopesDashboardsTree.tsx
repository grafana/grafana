import { ScopesDashboardsTreeDashboardItem } from './ScopesDashboardsTreeDashboardItem';
import { ScopesDashboardsTreeFolderItem } from './ScopesDashboardsTreeFolderItem';
import { OnFolderUpdate, SuggestedDashboardsFoldersMap } from './types';

export interface ScopesDashboardsTreeProps {
  folders: SuggestedDashboardsFoldersMap;
  folderPath: string[];
  onFolderUpdate: OnFolderUpdate;
}

export function ScopesDashboardsTree({ folders, folderPath, onFolderUpdate }: ScopesDashboardsTreeProps) {
  const folderId = folderPath[folderPath.length - 1];
  const folder = folders[folderId];

  return (
    <div role="tree">
      {Object.entries(folder.folders).map(([subFolderId, subFolder]) => (
        <ScopesDashboardsTreeFolderItem
          key={subFolderId}
          folder={subFolder}
          folders={folder.folders}
          folderPath={[...folderPath, subFolderId]}
          onFolderUpdate={onFolderUpdate}
        />
      ))}

      {Object.values(folder.dashboards).map((dashboard) => (
        <ScopesDashboardsTreeDashboardItem key={dashboard.dashboard} dashboard={dashboard} />
      ))}
    </div>
  );
}
