import { urlUtil } from '@grafana/data';
import { useQueryParams } from 'app/core/hooks/useQueryParams';

import { ScopesDashboardsTreeFolderItem } from './ScopesDashboardsTreeFolderItem';
import { ScopesNavigationTreeLink } from './ScopesNavigationTreeLink';
import { OnFolderUpdate, SuggestedNavigationsFoldersMap } from './types';

export interface ScopesDashboardsTreeProps {
  folders: SuggestedNavigationsFoldersMap;
  folderPath: string[];
  onFolderUpdate: OnFolderUpdate;
}

export function ScopesDashboardsTree({ folders, folderPath, onFolderUpdate }: ScopesDashboardsTreeProps) {
  const [queryParams] = useQueryParams();

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
      {Object.values(folder.suggestedNavigations).map((navigation) => (
        <ScopesNavigationTreeLink
          key={navigation.id + navigation.title}
          to={urlUtil.renderUrl(navigation.url, queryParams)}
          title={navigation.title}
          id={navigation.id}
        />
      ))}
    </div>
  );
}
