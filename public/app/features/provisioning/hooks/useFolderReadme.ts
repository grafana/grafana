import { skipToken } from '@reduxjs/toolkit/query/react';

import { isFetchError } from '@grafana/runtime';
import { type Folder } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView, useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';
import { useRefetchOnRepoSync } from './useRefetchOnRepoSync';

export type FolderReadmeStatus = 'loading' | 'missing' | 'error' | 'ok';

export interface UseFolderReadmeResult {
  repository?: RepositoryView;
  folder?: Folder;
  /** Path of the README relative to the repository's configured root. */
  readmePath: string;
  status: FolderReadmeStatus;
  /** True while fetching, unlike `status === 'loading'` which a non-provisioned folder reports forever. */
  isLoading: boolean;
  /**
   * True whenever a request is in flight, including when switching to another
   * doc while the previous one's content is still shown (RTK keeps stale `data`
   * and reports `isLoading: false` on arg changes). Drives the tab-switch spinner.
   */
  isFetching: boolean;
  /** Markdown body of the README, or undefined when not loaded successfully. */
  markdownContent: string | undefined;
  refetch: () => void;
}

/**
 * Resolves a folder documentation file and fetches it through the provisioning
 * files API. Defaults to the folder's `README.md` (derived from the source-path
 * annotation); pass `docPath` to fetch a specific convention doc instead — the
 * fetch, live-refresh, and status machinery are identical for every doc.
 *
 * Callers must gate on the `provisioning.readmes` OpenFeature toggle before
 * mounting any component that invokes this hook.
 *
 * Returns a tagged `status` instead of raw boolean flags so callers can
 * exhaustively switch on the four states without reconstructing the machine.
 */
export function useFolderReadme(folderUID: string, docPath?: string): UseFolderReadmeResult {
  const { repository, folder, isLoading: isRepoLoading } = useGetResourceRepositoryView({ folderName: folderUID });

  const sourcePath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';
  const defaultReadmePath = sourcePath ? `${sourcePath.replace(/\/+$/, '')}/README.md` : 'README.md';
  const readmePath = docPath || defaultReadmePath;

  const shouldFetch = !!repository && !!folderUID && !isRepoLoading;

  const {
    // `currentData` (not `data`) reflects the CURRENT arg — RTK keeps the
    // previous doc's `data` while a newly selected doc is still fetching, which
    // would otherwise render the old content beneath the new tab's label.
    currentData: fileData,
    isLoading: isFileLoading,
    isFetching: isFileFetching,
    error,
    refetch,
  } = useGetRepositoryFilesWithPathQuery(
    shouldFetch
      ? {
          name: repository.name,
          path: readmePath,
        }
      : skipToken
  );

  // No current-arg data while a request is in flight = still loading (covers the
  // first load and switching to a not-yet-cached doc).
  const isLoading = isRepoLoading || isFileLoading || (isFileFetching && !fileData);

  useRefetchOnRepoSync(repository?.name, refetch);

  let status: FolderReadmeStatus;
  if (isLoading) {
    status = 'loading';
  } else if (error && isFetchError(error) && error.status === 404) {
    status = 'missing';
  } else if (error) {
    status = 'error';
  } else if (fileData) {
    status = 'ok';
  } else {
    // No error, no data, not loading — shouldn't happen in practice but
    // treat as loading (the query hasn't started, e.g. skipToken is active).
    status = 'loading';
  }

  let markdownContent: string | undefined;
  if (status === 'ok') {
    const rawFile = fileData?.resource?.file;
    if (typeof rawFile === 'string') {
      markdownContent = rawFile;
    } else if (rawFile && typeof rawFile === 'object' && 'content' in rawFile) {
      const { content } = rawFile;
      if (typeof content === 'string') {
        markdownContent = content;
      }
    }
  }

  return {
    repository,
    folder,
    readmePath,
    status,
    isLoading,
    isFetching: isFileFetching,
    markdownContent,
    refetch,
  };
}
