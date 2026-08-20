import { skipToken } from '@reduxjs/toolkit/query/react';
import { useMemo } from 'react';

import { type Folder } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView, useGetRepositoryFilesQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { type FolderDoc, listFolderDocs } from '../utils/folderDocConventions';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export interface UseFolderDocsResult {
  repository?: RepositoryView;
  folder?: Folder;
  /** Folder's source path relative to the repository root, without trailing slash. */
  sourceDir: string;
  /** Markdown docs found in the folder: conventions first, then other markdown. */
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

  const sourcePath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';
  const sourceDir = sourcePath.replace(/\/+$/, '');

  const shouldFetch = !!repository?.name && !!folderUID && !isRepoLoading;

  const { data, isLoading: isFilesLoading } = useGetRepositoryFilesQuery(
    shouldFetch ? { name: repository.name } : skipToken
  );

  const docs = useMemo(() => {
    const items = data?.items ?? [];
    const paths = items
      .map((item) => (item && typeof item === 'object' && 'path' in item ? String(item.path) : ''))
      .filter(Boolean);
    return listFolderDocs(paths, sourceDir);
  }, [data, sourceDir]);

  return {
    repository,
    folder,
    sourceDir,
    docs,
    isLoading: isRepoLoading || isFilesLoading,
  };
}
