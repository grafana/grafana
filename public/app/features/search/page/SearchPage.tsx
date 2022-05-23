import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync, useDebounce } from 'react-use';

import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { Input, useStyles2, Spinner, InlineSwitch, InlineFieldRow, InlineField, Select } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { backendSrv } from 'app/core/services/backend_srv';
import { FolderDTO } from 'app/types';

import { useSearchQuery } from '../hooks/useSearchQuery';
import { getGrafanaSearcher } from '../service';

import { SearchView } from './components/SearchView';

const node: NavModelItem = {
  id: 'search',
  text: 'Search playground',
  subTitle: 'The body below will eventually live inside existing UI layouts',
  icon: 'dashboard',
  url: 'search',
};

export default function SearchPage() {
  const styles = useStyles2(getStyles);

  const [showManage, setShowManage] = useState(false); // grid vs list view
  const [folderDTO, setFolderDTO] = useState<FolderDTO>(); // grid vs list view
  const folders = useAsync(async () => {
    const rsp = await getGrafanaSearcher().search({
      query: '*',
      kind: ['folder'],
    });
    return rsp.view.map((v) => ({ value: v.uid, label: v.name }));
  }, []);
  const setFolder = async (uid?: string) => {
    if (uid?.length) {
      const dto = await backendSrv.getFolderByUid(uid);
      setFolderDTO(dto);
    } else {
      setFolderDTO(undefined);
    }
  };

  // since we don't use "query" from use search... it is not actually loaded from the URL!
  const { query, onQueryChange } = useSearchQuery({});

  const [inputValue, setInputValue] = useState(query.query ?? '');
  const onSearchQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setInputValue(e.currentTarget.value);
  };
  useDebounce(() => onQueryChange(inputValue), 200, [inputValue]);

  return (
    <Page navModel={{ node: node, main: node }}>
      <Page.Contents
        className={css`
          display: flex;
          flex-direction: column;
          overflow: hidden;
        `}
      >
        <Input
          value={inputValue}
          onChange={onSearchQueryChange}
          autoFocus
          spellCheck={false}
          placeholder="Search for dashboards and panels"
          className={styles.searchInput}
          suffix={false ? <Spinner /> : null}
        />
        <InlineFieldRow>
          <InlineField label="Show manage options">
            <InlineSwitch value={showManage} onChange={() => setShowManage(!showManage)} />
          </InlineField>
          <InlineField label="Folder">
            <Select
              options={folders.value ?? []}
              isLoading={folders.loading}
              onChange={(v) => setFolder(v?.value)}
              isClearable
            />
          </InlineField>
        </InlineFieldRow>

        <SearchView showManage={showManage} folderDTO={folderDTO} queryText={query.query} />
      </Page.Contents>
    </Page>
  );
}

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
