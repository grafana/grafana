import { css } from '@emotion/css';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
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
  const styles = useStyles2(getStyles);

  const folderId = folderPath[folderPath.length - 1];
  const folder = folders[folderId];

  // Separate regular items from subScope items
  const regularFolders: Array<[string, (typeof folder.folders)[string]]> = [];
  const subScopeFolders: Array<[string, (typeof folder.folders)[string]]> = [];

  Object.entries(folder.folders).forEach(([subFolderId, subFolder]) => {
    if (subFolder.isSubScope) {
      subScopeFolders.push([subFolderId, subFolder]);
    } else {
      regularFolders.push([subFolderId, subFolder]);
    }
  });

  const regularNavigations = Object.values(folder.suggestedNavigations);

  const hasRegularContent = regularFolders.length > 0 || regularNavigations.length > 0;
  const hasSubScopeContent = subScopeFolders.length > 0;

  return (
    <div role="tree">
      {/* Regular folders and navigations */}
      {regularFolders.map(([subFolderId, subFolder]) => (
        <ScopesDashboardsTreeFolderItem
          key={subFolderId}
          folder={subFolder}
          folders={folder.folders}
          folderPath={[...folderPath, subFolderId]}
          onFolderUpdate={onFolderUpdate}
        />
      ))}
      {regularNavigations.map((navigation) => (
        <ScopesNavigationTreeLink
          key={navigation.id + navigation.title}
          to={urlUtil.renderUrl(navigation.url, queryParams)}
          title={navigation.title}
          id={navigation.id}
        />
      ))}

      {/* Separator between regular and subScope sections */}
      {hasRegularContent && hasSubScopeContent && <hr className={styles.separator} />}

      {/* SubScope folders */}
      {subScopeFolders.map(([subFolderId, subFolder]) => (
        <ScopesDashboardsTreeFolderItem
          key={subFolderId}
          folder={subFolder}
          folders={folder.folders}
          folderPath={[...folderPath, subFolderId]}
          onFolderUpdate={onFolderUpdate}
        />
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  separator: css({
    border: 'none',
    borderTop: `1px solid ${theme.colors.border.weak}`,
    margin: theme.spacing(1, 0),
  }),
});
