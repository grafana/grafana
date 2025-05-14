import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ScopesDashboardsTree } from './ScopesDashboardsTree';
import { OnFolderUpdate, SuggestedNavigationsFolder, SuggestedNavigationsFoldersMap } from './types';

export interface ScopesDashboardsTreeFolderItemProps {
  folder: SuggestedNavigationsFolder;
  folderPath: string[];
  folders: SuggestedNavigationsFoldersMap;
  onFolderUpdate: OnFolderUpdate;
}

export function ScopesDashboardsTreeFolderItem({
  folder,
  folderPath,
  folders,
  onFolderUpdate,
}: ScopesDashboardsTreeFolderItemProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container} role="treeitem" aria-selected={folder.expanded}>
      <button
        className={styles.expand}
        data-testid={`scopes-dashboards-${folder.title}-expand`}
        aria-label={
          folder.expanded ? t('scopes.dashboards.collapse', 'Collapse') : t('scopes.dashboards.expand', 'Expand')
        }
        onClick={() => {
          onFolderUpdate(folderPath, !folder.expanded);
        }}
      >
        <Icon name={!folder.expanded ? 'angle-right' : 'angle-down'} className={styles.icon} />

        {folder.title}
      </button>

      {folder.expanded && (
        <div className={styles.children}>
          <ScopesDashboardsTree folders={folders} folderPath={folderPath} onFolderUpdate={onFolderUpdate} />
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(0.5, 0),
    }),
    expand: css({
      alignItems: 'flex-start',
      background: 'none',
      border: 0,
      display: 'flex',
      gap: theme.spacing(1),
      margin: 0,
      padding: 0,
      textAlign: 'left',
      wordBreak: 'break-word',
    }),
    icon: css({
      marginTop: theme.spacing(0.25),
    }),
    children: css({
      paddingLeft: theme.spacing(3),
    }),
  };
};
