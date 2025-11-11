import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, IconButton, Spinner, useStyles2 } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';

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

  // get scopesselector service
  const scopesSelectorService = useScopesServices()?.scopesSelectorService ?? undefined;

  return (
    <div className={styles.container} role="treeitem" aria-selected={folder.expanded}>
      <div className={styles.row}>
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

          <span className={styles.titleContainer}>{folder.title}</span>
          {folder.loading && <Spinner inline size="sm" className={styles.loadingIcon} />}
        </button>

        {folder.isSubScope && (
          <IconButton
            className={styles.exchangeIcon}
            tooltip={t('scopes.dashboards.exchange', 'Change root scope to {{scope}}', {
              scope: folder.subScopeName || '',
            })}
            name="exchange-alt"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (folder.subScopeName && scopesSelectorService) {
                scopesSelectorService.changeScopes([folder.subScopeName]);
              }
            }}
          />
        )}
      </div>

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
    row: css({
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing(1),
      width: '100%',
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
      flex: 1,
    }),
    icon: css({
      marginTop: theme.spacing(0.25),
    }),
    titleContainer: css({
      display: 'flex',
      alignItems: 'center',
      flex: 1,
    }),
    exchangeIcon: css({
      opacity: 0.7,
      flexShrink: 0,
      marginTop: theme.spacing(0.25),
    }),
    loadingIcon: css({
      flexShrink: 0,
      marginLeft: theme.spacing(0.5),
      marginTop: theme.spacing(0.25),
    }),
    children: css({
      paddingLeft: theme.spacing(2),
      marginLeft: theme.spacing(1),
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
  };
};
