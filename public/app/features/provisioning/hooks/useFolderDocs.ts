import { skipToken } from '@reduxjs/toolkit/query/react';
import { useMemo } from 'react';

import { type Folder } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView, useGetRepositoryFilesQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { type FolderDoc, listFolderDocs } from '../utils/folderDocConventions';

import { isFileItem } from './useGetRepositoryFolders';
import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';
import { useRefetchOnRepoSync } from './useRefetchOnRepoSync';

export interface UseFolderDocsResult {
  repository?: RepositoryView;
  folder?: Folder;
  /** Markdown docs in the folder: README first (synthesized if missing), other conventions, then other markdown. */
  docs: FolderDoc[];
  /** True while resolving the repository or listing its files. */
  isLoading: boolean;
}

/**
 * Discovers the markdown docs directly inside a provisioned folder by listing the
 * repository's files once and ordering them via {@link listFolderDocs} (README,
 * Contributing, Security first, then any other markdown files).
 *
 * Listing the whole repo (rather than probing each path) keeps this to a single
 * cached request that is shared with the resource tree view, and only the active
 * doc's content is fetched on demand (see `useFolderReadme`).
 *
 * Callers must gate on the `provisioning.readmes` OpenFeature toggle before mounting.
 */
export function useFolderDocs(folderUID: string): UseFolderDocsResult {
  const { repository, folder, isLoading: isRepoLoading } = useGetResourceRepositoryView({ folderName: folderUID });

  const sourceDir = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';

  const shouldFetch = !!repository?.name && !!folderUID && !isRepoLoading;

  const {
    data,
    isLoading: isFilesLoading,
    refetch,
  } = useGetRepositoryFilesQuery(shouldFetch ? { name: repository.name } : skipToken);

  // Keep the tab set fresh: a completed pull can add/remove/rename markdown files.
  // Gate on the same condition as the query so we never refetch one that hasn't started.
  useRefetchOnRepoSync(shouldFetch ? repository.name : undefined, refetch);

  const docs = useMemo(() => {
    const paths = (data?.items ?? []).filter(isFileItem).map((item) => item.path);
    return listFolderDocs(paths, sourceDir);
  }, [data, sourceDir]);

  return {
    repository,
    folder,
    docs,
    isLoading: isRepoLoading || isFilesLoading,
  };
}
