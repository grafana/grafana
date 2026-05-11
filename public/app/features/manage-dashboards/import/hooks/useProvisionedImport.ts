import { useEffect } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import {
  getCanPushToConfiguredBranch,
  getDefaultRef,
  getDefaultWorkflow,
} from 'app/features/provisioning/components/defaults';
import { generatePath, slugifyForFilename } from 'app/features/provisioning/components/utils/path';
import { generateTimestamp } from 'app/features/provisioning/components/utils/timestamp';
import {
  useGetResourceRepositoryView,
  RepoViewStatus,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { useImportProvisionedSave } from './useImportProvisionedSave';

export interface ProvisionedImportDefaults {
  workflow?: string;
  ref: string;
  path: string;
  repo: string;
}

export interface UseProvisionedImportArgs {
  /** Watched folder UID — string or undefined. */
  folderUid: string | undefined;
  /**
   * Returns the title used when generating the default path.
   * Caller wraps `getValues('title')` etc. **Identity must be stable** —
   * wrap in `useCallback` with non-title deps so the defaults effect
   * fires only on repo/folder transitions, not on title edits.
   */
  getDefaultTitle: () => string;
  /**
   * Caller writes the seeded values into the form.
   * **Identity must be stable** — wrap in `useCallback` with narrow deps.
   */
  applyDefaults: (defaults: ProvisionedImportDefaults) => void;
  /** V1 only — pass true when inputs.libraryPanels.length > 0. */
  hasLibraryPanels?: boolean;
}

export interface UseProvisionedImportResult {
  isProvisioned: boolean;
  isOrphaned: boolean;
  isRepoLoading: boolean;
  isReadOnlyRepo: boolean;
  isLPBlocked: boolean;
  canPushToConfiguredBranch: boolean;
  repository?: RepositoryView;
  /** Render gate for ProvisionedImportFields (covers Ready and Orphaned). */
  shouldRenderProvisionedFields: boolean;
  /** True when submit must be blocked entirely — not just visually. */
  submitDisabled: boolean;
  /** Forwarded from useImportProvisionedSave. No-op if repository missing. */
  save: ReturnType<typeof useImportProvisionedSave>['save'];
  error: string | undefined;
}

export function useProvisionedImport({
  folderUid,
  getDefaultTitle,
  applyDefaults,
  hasLibraryPanels = false,
}: UseProvisionedImportArgs): UseProvisionedImportResult {
  const { repository, status, isReadOnlyRepo } = useGetResourceRepositoryView({
    folderName: folderUid || undefined,
  });

  const isProvisioned = status === RepoViewStatus.Ready && !!repository;
  const isOrphaned = status === RepoViewStatus.Orphaned;
  const isRepoLoading = status === RepoViewStatus.Loading;
  const isRepoError = status === RepoViewStatus.Error;
  const isLPBlocked = isProvisioned && hasLibraryPanels;

  // Seed provisioning form defaults when a repo becomes available or the folder changes.
  // getDefaultTitle and applyDefaults must have stable identities (useCallback) so this
  // effect does not re-fire on unrelated renders such as title edits.
  useEffect(() => {
    if (!isProvisioned || !repository) {
      return;
    }
    applyDefaults({
      workflow: getDefaultWorkflow(repository),
      ref: getDefaultRef(repository, 'import'),
      path: generatePath({
        timestamp: generateTimestamp(),
        slug: slugifyForFilename(getDefaultTitle()),
      }),
      repo: repository.name,
    });
  }, [isProvisioned, repository, folderUid, getDefaultTitle, applyDefaults]);

  const provisionedSave = useImportProvisionedSave({ repository });

  const canPushToConfiguredBranch = isProvisioned ? getCanPushToConfiguredBranch(repository) : false;
  const submitDisabled =
    isRepoLoading ||
    isRepoError ||
    isOrphaned ||
    isLPBlocked ||
    (isProvisioned && isReadOnlyRepo) ||
    provisionedSave.isLoading;
  const shouldRenderProvisionedFields = isProvisioned || isOrphaned;

  return {
    isProvisioned,
    isOrphaned,
    isRepoLoading,
    isReadOnlyRepo,
    isLPBlocked,
    canPushToConfiguredBranch,
    repository,
    shouldRenderProvisionedFields,
    submitDisabled,
    save: provisionedSave.save,
    error: provisionedSave.error,
  };
}
