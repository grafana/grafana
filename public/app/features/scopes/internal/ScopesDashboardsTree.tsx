import { SuggestedDashboardsFoldersMap } from '@grafana/data';

import { ScopesDashboardsTreeDashboardItem } from './ScopesDashboardsTreeDashboardItem';
import { ScopesDashboardsTreeFolderItem } from './ScopesDashboardsTreeFolderItem';

export interface ScopesDashboardsTreeProps {
  folders: SuggestedDashboardsFoldersMap;
  folderPath: string[];
  onFolderUpdate: (path: string[], isExpanded: boolean) => void;
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
