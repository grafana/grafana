import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Input, useStyles2, Spinner } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { FolderDTO, AccessControlAction } from 'app/types';

import { useKeyNavigationListener } from '../hooks/useSearchKeyboardSelection';
import { SearchView } from '../page/components/SearchView';
import { getSearchStateManager } from '../state/SearchStateManager';

import { DashboardActions } from './DashboardActions';

export interface Props {
  folder?: FolderDTO;
}

export const ManageDashboardsNew = React.memo(({ folder }: Props) => {
  const styles = useStyles2(getStyles);
  // since we don't use "query" from use search... it is not actually loaded from the URL!
  const stateManager = getSearchStateManager();
  const state = stateManager.useState();
  const { onKeyDown, keyboardEvents } = useKeyNavigationListener();

  // TODO: we need to refactor DashboardActions to use folder.uid instead
  const folderId = folder?.id;
  // const folderUid = folder?.uid;
  const canSave = folder?.canSave;
  const { isEditor } = contextSrv;
  const hasEditPermissionInFolders = folder ? canSave : contextSrv.hasEditPermissionInFolders;
  const canCreateFolders = contextSrv.hasAccess(AccessControlAction.FoldersCreate, isEditor);
  const canCreateDashboardsFallback = hasEditPermissionInFolders || !!canSave;
  const canCreateDashboards = folder?.id
    ? contextSrv.hasAccessInMetadata(AccessControlAction.DashboardsCreate, folder, canCreateDashboardsFallback)
    : contextSrv.hasAccess(AccessControlAction.DashboardsCreate, canCreateDashboardsFallback);
  const viewActions = (folder === undefined && canCreateFolders) || canCreateDashboards;

  useEffect(() => stateManager.initStateFromUrl(folder?.uid), [folder?.uid, stateManager]);

  return (
    <>
      <div className={cx(styles.actionBar, 'page-action-bar')}>
        <div className={cx(styles.inputWrapper, 'gf-form gf-form--grow m-r-2')}>
          <Input
            value={state.query ?? ''}
            onChange={(e) => stateManager.onQueryChange(e.currentTarget.value)}
            onKeyDown={onKeyDown}
            autoFocus
            spellCheck={false}
            placeholder={state.includePanels ? 'Search for dashboards and panels' : 'Search for dashboards'}
            className={styles.searchInput}
            suffix={false ? <Spinner /> : null}
          />
        </div>
        {viewActions && (
          <DashboardActions
            folderId={folderId}
            canCreateFolders={canCreateFolders}
            canCreateDashboards={canCreateDashboards}
          />
        )}
      </div>

      <SearchView
        showManage={Boolean(isEditor || hasEditPermissionInFolders || canSave)}
        folderDTO={folder}
        hidePseudoFolders={true}
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
