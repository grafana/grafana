import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Input, useStyles2, Spinner } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { FolderDTO } from 'app/types';

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

  // TODO: we need to refactor DashboardActions to use folder.uid instead
  const folderId = folder?.id;
  // const folderUid = folder?.uid;
  const canSave = folder?.canSave;
  const hasEditPermissionInFolders = folder ? canSave : contextSrv.hasEditPermissionInFolders;

  const { isEditor } = contextSrv;

  const [inputValue, setInputValue] = useState(query.query ?? '');
  const onSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setInputValue(e.currentTarget.value);
  };
  useDebounce(() => onQueryChange(inputValue), 200, [inputValue]);

  return (
    <>
      <div className="page-action-bar">
        <div className="gf-form gf-form--grow m-r-2">
          <Input
            value={inputValue}
            onChange={onSearchQueryChange}
            autoFocus
            spellCheck={false}
            placeholder="Search for dashboards and panels"
            className={styles.searchInput}
            suffix={false ? <Spinner /> : null}
          />
        </div>
        <DashboardActions isEditor={isEditor} canEdit={hasEditPermissionInFolders || canSave} folderId={folderId} />
      </div>

      <SearchView
        showManage={isEditor || hasEditPermissionInFolders || canSave}
        folderDTO={folder}
        queryText={query.query}
        hidePseudoFolders={true}
      />
    </>
  );
});

ManageDashboardsNew.displayName = 'ManageDashboardsNew';

export default ManageDashboardsNew;

const getStyles = (theme: GrafanaTheme2) => ({
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
