import { skipToken } from '@reduxjs/toolkit/query/react';

import { isFetchError } from '@grafana/runtime';
import { useGetRepositoryFilesWithPathQuery } from 'app/api/clients/provisioning/v0alpha1';

import { useRefetchOnRepoSync } from './useRefetchOnRepoSync';

export type FolderReadmeStatus = 'loading' | 'missing' | 'error' | 'ok';

export interface UseFolderReadmeResult {
  status: FolderReadmeStatus;
  /** Markdown body of the doc, or undefined when not loaded successfully. */
  markdownContent: string | undefined;
  refetch: () => void;
  /**
   * Timestamp of the last completed repository sync (`status.sync.finished`), or
   * undefined. Advances once per pull; callers can key cache refreshes off it so a
   * sync that changes resources without touching the README isn't missed.
   */
  syncFinished: number | undefined;
}

/**
 * Fetches a folder documentation file (`docPath`, relative to the repository's
 * configured root) from `repositoryName` through the provisioning files API.
 * The fetch, live-refresh, and status machinery are identical for every doc.
 *
 * Reports `status: 'loading'` until a repository name is known — callers resolve
 * the repository once (see `useFolderDocs`) and pass its name in.
 *
 * Callers must gate on the `provisioning.readmes` OpenFeature toggle before
 * mounting any component that invokes this hook.
 *
 * Returns a tagged `status` instead of raw boolean flags so callers can
 * exhaustively switch on the four states without reconstructing the machine.
 */
export function useFolderReadme(repositoryName: string | undefined, docPath: string): UseFolderReadmeResult {
  const {
    // `currentData` (not `data`) reflects the CURRENT arg — RTK keeps the
    // previous doc's `data` while a newly selected doc is still fetching, which
    // would otherwise render the old content beneath the new tab's label.
    currentData: fileData,
    isLoading: isFileLoading,
    isFetching: isFileFetching,
    error,
    refetch,
  } = useGetRepositoryFilesWithPathQuery(repositoryName ? { name: repositoryName, path: docPath } : skipToken);

  // No current-arg data while a request is in flight = still loading (covers the
  // first load and switching to a not-yet-cached doc).
  const isLoading = isFileLoading || (isFileFetching && !fileData);

  const syncFinished = useRefetchOnRepoSync(repositoryName, refetch);

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
    status,
    markdownContent,
    refetch,
    syncFinished,
  };
}
