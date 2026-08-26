import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useRef } from 'react';

import { isFetchError } from '@grafana/runtime';
import { type Folder } from 'app/api/clients/folder/v1beta1';
import {
  type RepositoryView,
  useGetRepositoryFilesWithPathQuery,
  useListRepositoryQuery,
} from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';

import { useGetResourceRepositoryView } from './useGetResourceRepositoryView';

export type FolderReadmeStatus = 'loading' | 'missing' | 'error' | 'ok';

export interface UseFolderReadmeResult {
  repository?: RepositoryView;
  folder?: Folder;
  /** Path of the README relative to the repository's configured root. */
  readmePath: string;
  status: FolderReadmeStatus;
  /** True while fetching, unlike `status === 'loading'` which a non-provisioned folder reports forever. */
  isLoading: boolean;
  /** Markdown body of the README, or undefined when not loaded successfully. */
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
 * Resolves a folder's README.md path (using the source-path annotation when
 * present) and fetches it through the provisioning files API.
 *
 * Callers must gate on the `provisioning.readmes` OpenFeature toggle before
 * mounting any component that invokes this hook.
 *
 * Returns a tagged `status` instead of raw boolean flags so callers can
 * exhaustively switch on the four states without reconstructing the machine.
 */
export function useFolderReadme(folderUID: string): UseFolderReadmeResult {
  const { repository, folder, isLoading: isRepoLoading } = useGetResourceRepositoryView({ folderName: folderUID });

  const sourcePath = folder?.metadata?.annotations?.[AnnoKeySourcePath] || '';
  const readmePath = sourcePath ? `${sourcePath.replace(/\/+$/, '')}/README.md` : 'README.md';

  const shouldFetch = !!repository && !!folderUID && !isRepoLoading;

  const {
    data: fileData,
    isLoading: isFileLoading,
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

  const isLoading = isRepoLoading || isFileLoading;

  // Watch repo sync, not the Job: the Job is deleted on completion so its
  // terminal state is never observed (#1223).
  const { data: repoData } = useListRepositoryQuery(
    repository?.name ? { fieldSelector: `metadata.name=${repository.name}`, watch: true } : skipToken
  );
  const repo = repoData?.items?.[0];
  const sync = repo?.status?.sync;
  const syncFinished = sync?.finished;

  // `finished` advances once per completed sync; dedupes repeat watch events and
  // seeds a baseline so mount-loaded content isn't refetched.
  const lastFinishedRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!repo) {
      return;
    }
    const finished = syncFinished ?? 0;
    if (lastFinishedRef.current === undefined) {
      lastFinishedRef.current = finished;
      return;
    }
    // sync only advances on pull, so push/pr/move/delete never reach here.
    if (finished > lastFinishedRef.current && (sync?.state === 'success' || sync?.state === 'warning')) {
      lastFinishedRef.current = finished;
      refetch();
    }
  }, [repo, sync, syncFinished, refetch]);

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
    markdownContent,
    refetch,
    syncFinished,
  };
}
