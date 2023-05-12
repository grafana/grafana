import React, { useState } from 'react';
import { useAsync } from 'react-use';

import { getBackendSrv } from '@grafana/runtime';
import { Button, FilterInput, LoadingBar } from '@grafana/ui';

import { NestedFolderList } from './NestedFolderList';
import { RootFolder, RootFolderWithUiState } from './types';

async function fetchRootFolders(): Promise<RootFolderWithUiState[]> {
  const root = await getBackendSrv().get<RootFolder[]>('/api/folders');
  const foldersWithLevel = root.map((rootFolder) => {
    return { title: rootFolder.title, uid: rootFolder.uid, level: 1, expanded: false };
  });

  return foldersWithLevel;
}

export function NestedFolderPicker() {
  const [search, setSearch] = useState('');
  const state = useAsync(fetchRootFolders);

  return (
    <fieldset>
      <legend>Select folder</legend>
      <FilterInput placeholder="Search folder" value={search} escapeRegex={false} onChange={(val) => setSearch(val)} />

      {state.loading && <LoadingBar width={300} />}
      {state.error && <p>{state.error.message}</p>}
      {state.value && <NestedFolderList data={state.value} />}
      <Button>Select</Button>
    </fieldset>
  );
}
