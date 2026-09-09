import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useMemo } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { useUrlParams } from 'app/core/navigation/hooks';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import {
  RepoViewStatus,
  useGetResourceRepositoryView,
} from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { getIsReadOnlyRepo } from 'app/features/provisioning/utils/repository';
import { type DashboardMeta } from 'app/types/dashboard';

import { getCanPushToConfiguredBranch, getDefaultWorkflow, shouldEnforceBranchTemplate } from '../components/defaults';
import { generateNewBranchName } from '../components/utils/newBranchName';
import { generatePath } from '../components/utils/path';
import { generateTimestamp } from '../components/utils/timestamp';
import { type RecoverToNewBranch } from '../types';
import { type ProvisionedDashboardFormData } from '../types/form';

interface UseDefaultValuesParams {
  meta: DashboardMeta;
  defaultTitle: string;
  defaultDescription?: string;
  loadedFromRef?: string;
  saveAsCopy?: boolean;
  gitConventionsEnabled?: boolean;
  /** Deleted-branch recovery: default to a fresh branch instead of the configured one or the (gone) preview ref. */
  recoverToNewBranch?: RecoverToNewBranch;
}

export function useDefaultValues({
  meta,
  defaultTitle,
  defaultDescription,
  loadedFromRef,
  saveAsCopy,
  gitConventionsEnabled = false,
  recoverToNewBranch,
}: UseDefaultValuesParams) {
  const annotations = meta.k8s?.annotations;
  const managerKind = annotations?.[AnnoKeyManagerKind];
  const managerIdentity = annotations?.[AnnoKeyManagerIdentity];
  const sourcePath = annotations?.[AnnoKeySourcePath];
  const { folderUid, slug } = meta;
  const { repository, folder, isLoading, status, error } = useGetResourceRepositoryView({
    name: managerKind === 'repo' ? managerIdentity : undefined,
    folderName: folderUid,
  });
  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath];

  // Memoized so the generated branch name and timestamped path don't change on every render: the form
  // resets to these defaults with keepDirtyValues, so a regenerated value would silently replace a
  // still-pristine field.
  const values = useMemo(() => {
    if (!repository) {
      return null;
    }

    // The branch workflow is forced when recovering from a deleted branch (the loaded ref is gone) or
    // when an enforced name template must be applied (useBranchTemplate then overwrites the ref).
    const forceBranch = Boolean(recoverToNewBranch) || shouldEnforceBranchTemplate(repository, gitConventionsEnabled);
    const workflow = forceBranch ? 'branch' : getDefaultWorkflow(repository, loadedFromRef);

    return {
      ref: workflow === 'branch' ? generateNewBranchName('dashboard') : (repository.branch ?? ''),
      path: generatePath({
        timestamp: generateTimestamp(),
        pathFromAnnotation: saveAsCopy ? undefined : sourcePath,
        slug: saveAsCopy ? undefined : slug,
        folderPath,
      }),
      repo: managerIdentity || repository.name || '',
      comment: '',
      folder: {
        uid: folderUid,
        title: '',
      },
      title: saveAsCopy ? `${defaultTitle} Copy` : defaultTitle,
      description: defaultDescription ?? '',
      workflow,
      copyTags: saveAsCopy ? false : true,
    };
  }, [
    repository,
    loadedFromRef,
    saveAsCopy,
    sourcePath,
    slug,
    folderPath,
    folderUid,
    managerIdentity,
    defaultTitle,
    defaultDescription,
    gitConventionsEnabled,
    recoverToNewBranch,
  ]);

  if (isLoading || status === RepoViewStatus.Loading) {
    return {
      values: null,
      status: RepoViewStatus.Loading,
    };
  }

  if (status === RepoViewStatus.Error) {
    return {
      values: null,
      status: RepoViewStatus.Error,
      error,
    };
  }

  if (status === RepoViewStatus.Orphaned) {
    return {
      values: null,
      status: RepoViewStatus.Orphaned,
    };
  }

  if (!repository) {
    return {
      values: null,
      status: RepoViewStatus.Error,
      error: new Error('No repository found for this dashboard'),
    };
  }

  return {
    values,
    isNew: !meta.k8s?.name,
    repository,
    status,
  };
}

export interface ProvisionedDashboardData {
  defaultValues: ProvisionedDashboardFormData | null;
  repository?: RepositoryView;
  loadedFromRef?: string;
  isNew?: boolean;
  readOnly: boolean;
  canPushToConfiguredBranch: boolean;
  repoDataStatus: RepoViewStatus;
  /* error from useGetResourceRepositoryView  */
  error?: unknown;
}

/**
 * Custom hook to fetch and prepare data for a provisioned dashboard update/delete form.
 * It retrieves default values, repository information, and workflow options based on the current dashboard state.
 */

export function useProvisionedDashboardData(
  dashboard: DashboardScene,
  saveAsCopy?: boolean,
  recoverToNewBranch?: RecoverToNewBranch
): ProvisionedDashboardData {
  const { meta, title: defaultTitle, description: defaultDescription } = dashboard.useState();
  const [params] = useUrlParams();
  const loadedFromRef = params.get('ref') ?? undefined;
  const gitConventionsEnabled = useBooleanFlagValue('provisioning.gitConventions', false);

  const defaultValuesResult = useDefaultValues({
    meta,
    defaultTitle,
    defaultDescription,
    loadedFromRef,
    saveAsCopy,
    gitConventionsEnabled,
    recoverToNewBranch,
  });

  if (defaultValuesResult.status !== RepoViewStatus.Ready) {
    return {
      canPushToConfiguredBranch: false,
      defaultValues: null,
      repository: undefined,
      loadedFromRef,
      isNew: false,
      readOnly: true,
      repoDataStatus: defaultValuesResult.status,
      error: defaultValuesResult.error,
    };
  }

  const { values, isNew, repository } = defaultValuesResult;

  return {
    defaultValues: values,
    repository,
    loadedFromRef,
    canPushToConfiguredBranch: getCanPushToConfiguredBranch(repository),
    isNew,
    readOnly: getIsReadOnlyRepo(repository),
    repoDataStatus: defaultValuesResult.status,
  };
}
