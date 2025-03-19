import { urlUtil } from '@grafana/data';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { ScopesDashboardsTreeFolderItem } from './ScopesDashboardsTreeFolderItem';
import { ScopesNavigationTreeLink } from './ScopesNavigationTreeLink';
import { OnFolderUpdate, SuggestedDashboardsFoldersMap } from './types';

export interface ScopesDashboardsTreeProps {
  folders: SuggestedDashboardsFoldersMap;
  folderPath: string[];
  onFolderUpdate: OnFolderUpdate;
}

export function ScopesDashboardsTree({ folders, folderPath, onFolderUpdate }: ScopesDashboardsTreeProps) {
  const [queryParams] = useQueryParams();

  const folderId = folderPath[folderPath.length - 1];
  const folder = folders[folderId];

  console.log(folder);

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
      {Object.values(folder.suggestedNavigations).map((navigation) => (
        <ScopesNavigationTreeLink
          key={navigation.title}
          to={urlUtil.renderUrl(navigation.url, queryParams)}
          title={navigation.title}
          icon="link"
        />
      ))}

      {Object.values(folder.dashboards).map((dashboard) => (
        <ScopesNavigationTreeLink
          key={dashboard.dashboard}
          title={dashboard.dashboardTitle}
          to={urlUtil.renderUrl(`/d/${dashboard.dashboard}/`, queryParams)}
          icon="apps"
        />
      ))}
    </div>
  );
}
