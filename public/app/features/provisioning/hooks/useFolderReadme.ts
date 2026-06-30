import { skipToken } from '@reduxjs/toolkit/query/react';
import { useEffect, useRef } from 'react';

import { isFetchError } from '@grafana/runtime';
import { type Folder } from 'app/api/clients/folder/v1beta1';
import {
  type Job,
  type RepositoryView,
  useGetRepositoryFilesWithPathQuery,
  useListJobQuery,
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
}

/**
 * Only `pull`/`migrate` replicate remote content into Grafana, so only they can
 * change the locally served README; other actions touch the remote alone.
 * `warning` still counts — it's a completion that wrote content.
 */
export function isReadmeRefreshingJob(job: Job): boolean {
  const action = job.spec?.action;
  const state = job.status?.state;
  return (action === 'pull' || action === 'migrate') && (state === 'success' || state === 'warning');
}

/**
 * `handled` dedupes by job name so a finished pull lingering in the watched list
 * refetches only once; names are unique per repository.
 */
export function readmeRefetchJobNames(jobs: Job[], handled: ReadonlySet<string>): string[] {
  const names: string[] = [];
  for (const job of jobs) {
    const name = job.metadata?.name;
    if (name && !handled.has(name) && isReadmeRefreshingJob(job)) {
      names.push(name);
    }
  }
  return names;
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

  // Show pulled-in README edits without a manual page reload (#1223). Watch the
  // repo's jobs over the existing stream rather than polling, which is too
  // API-heavy for the browse-dashboards page.
  const { data: jobsData } = useListJobQuery(
    repository?.name
      ? { labelSelector: `provisioning.grafana.app/repository=${repository.name}`, watch: true }
      : skipToken
  );
  const handledJobsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const name of readmeRefetchJobNames(jobsData?.items ?? [], handledJobsRef.current)) {
      handledJobsRef.current.add(name);
      refetch();
    }
  }, [jobsData, refetch]);

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
  };
}
