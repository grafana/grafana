import { css, cx } from '@emotion/css';
import React from 'react';
import { useLocalStorage } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Input, useStyles2, Spinner } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { FolderDTO, AccessControlAction } from 'app/types';

import { SEARCH_PANELS_LOCAL_STORAGE_KEY } from '../constants';
import { useKeyNavigationListener } from '../hooks/useSearchKeyboardSelection';
import { useSearchQuery } from '../hooks/useSearchQuery';
import { SearchView } from '../page/components/SearchView';

import { DashboardActions } from './DashboardActions';

export interface Props {
  folder?: FolderDTO;
}

export const ManageDashboardsNew = React.memo(({ folder }: Props) => {
  const styles = useStyles2(getStyles);
  // since we don't use "query" from use search... it is not actually loaded from the URL!
  const { query, onQueryChange } = useSearchQuery({});
  const { onKeyDown, keyboardEvents } = useKeyNavigationListener();

  // TODO: we need to refactor DashboardActions to use folder.uid instead
  const folderId = folder?.id;
  // const folderUid = folder?.uid;
  const canSave = folder?.canSave;
  const hasEditPermissionInFolders = folder ? canSave : contextSrv.hasEditPermissionInFolders;

  let [includePanels, setIncludePanels] = useLocalStorage<boolean>(SEARCH_PANELS_LOCAL_STORAGE_KEY, true);
  if (!config.featureToggles.panelTitleSearch) {
    includePanels = false;
  }

  const { isEditor } = contextSrv;

  const onSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onQueryChange(e.currentTarget.value);
  };

  return (
    <>
      <div className={cx(styles.actionBar, 'page-action-bar')}>
        <div className={cx(styles.inputWrapper, 'gf-form gf-form--grow m-r-2')}>
          <Input
            value={query.query ?? ''}
            onChange={onSearchQueryChange}
            onKeyDown={onKeyDown}
            autoFocus
            spellCheck={false}
            placeholder={includePanels ? 'Search for dashboards and panels' : 'Search for dashboards'}
            className={styles.searchInput}
            suffix={false ? <Spinner /> : null}
          />
        </div>
        <DashboardActions
          folderId={folderId}
          canCreateFolders={contextSrv.hasAccess(AccessControlAction.FoldersCreate, isEditor)}
          canCreateDashboards={contextSrv.hasAccess(
            AccessControlAction.DashboardsCreate,
            hasEditPermissionInFolders || !!canSave
          )}
        />
      </div>

      <SearchView
        showManage={isEditor || hasEditPermissionInFolders || canSave}
        folderDTO={folder}
        hidePseudoFolders={true}
        includePanels={includePanels!}
        setIncludePanels={setIncludePanels}
        keyboardEvents={keyboardEvents}
      />
    </>
  );
});

ManageDashboardsNew.displayName = 'ManageDashboardsNew';

export default ManageDashboardsNew;

const getStyles = (theme: GrafanaTheme2) => ({
  actionBar: css`
    ${theme.breakpoints.down('sm')} {
      flex-wrap: wrap;
    }
  `,
  inputWrapper: css`
    ${theme.breakpoints.down('sm')} {
      margin-right: 0 !important;
    }
  `,
  searchInput: css`
    margin-bottom: 6px;
    min-height: ${theme.spacing(4)};
  `,
  unsupported: css`
    padding: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 18px;
  `,
  noResults: css`
    padding: ${theme.v1.spacing.md};
    background: ${theme.v1.colors.bg2};
    font-style: italic;
    margin-top: ${theme.v1.spacing.md};
  `,
});
