import { useCallback, useEffect } from 'react';
import { type SetValueConfig } from 'react-hook-form';

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

/** Minimal setValue signature covering only the provisioning fields the hook needs to set. */
type SetProvisioningField = (
  name: 'workflow' | 'ref' | 'path' | 'repo',
  value: string | undefined,
  options?: SetValueConfig
) => void;

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
  /** react-hook-form `setValue` — the hook writes provisioning fields directly. */
  setValue: SetProvisioningField;
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
  setValue,
  hasLibraryPanels = false,
}: UseProvisionedImportArgs): UseProvisionedImportResult {
  const { repository, status, isReadOnlyRepo } = useGetResourceRepositoryView({
    folderName: folderUid,
  });

  const isProvisioned = status === RepoViewStatus.Ready && !!repository;
  const isOrphaned = status === RepoViewStatus.Orphaned;
  const isRepoLoading = status === RepoViewStatus.Loading;
  const isRepoError = status === RepoViewStatus.Error;
  const isLPBlocked = isProvisioned && hasLibraryPanels;

  // Seed provisioning form defaults when a repo becomes available or the folder changes.
  // getDefaultTitle must have a stable identity (useCallback) so this effect does not
  // re-fire on unrelated renders such as title edits.
  const applyDefaults = useCallback(
    (repository: RepositoryView) => {
      setValue('workflow', getDefaultWorkflow(repository), { shouldDirty: false });
      setValue('ref', getDefaultRef(repository, 'import'), { shouldDirty: false });
      setValue('path', generatePath({ timestamp: generateTimestamp(), slug: slugifyForFilename(getDefaultTitle()) }), {
        shouldDirty: false,
      });
      setValue('repo', repository.name, { shouldDirty: false });
    },
    [setValue, getDefaultTitle]
  );

  useEffect(() => {
    if (!isProvisioned || !repository) {
      return;
    }
    applyDefaults(repository);
  }, [isProvisioned, repository, folderUid, applyDefaults]);

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
