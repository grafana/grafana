import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useMemo, useState } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { useUrlParams } from 'app/core/navigation/hooks';
import { AnnoKeyManagerIdentity, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { type DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { RepoViewStatus, type RepositoryViewData } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { getIsReadOnlyRepo } from 'app/features/provisioning/utils/repository';
import { type DashboardMeta } from 'app/types/dashboard';

import {
  getCanPushToConfiguredBranch,
  getDefaultRef,
  getDefaultWorkflow,
  shouldEnforceBranchTemplate,
} from '../components/defaults';
import { generateNewBranchName } from '../components/utils/newBranchName';
import { generatePath, slugifyForFilename } from '../components/utils/path';
import { generateTimestamp } from '../components/utils/timestamp';
import { type RecoverToNewBranch } from '../types';
import { type ProvisionedDashboardFormData } from '../types/form';

import { type DashboardRepositoryView } from './useDashboardRepositoryView';

interface GetDefaultValuesParams {
  meta: DashboardMeta;
  defaultTitle: string;
  defaultDescription?: string;
  loadedFromRef?: string;
  saveAsCopy?: boolean;
  isNew: boolean;
  view: Pick<RepositoryViewData, 'repository' | 'folder' | 'status' | 'error'>;
  /** Feeds the fallback filename for a save with no title to slugify; the caller keeps it stable across recomputes */
  timestamp: string;
  /** Deleted-branch recovery: default to a fresh branch instead of the configured one or the (gone) preview ref. */
  recoverToNewBranch?: RecoverToNewBranch;
}

export function getDefaultValues({
  meta,
  defaultTitle,
  defaultDescription,
  loadedFromRef,
  saveAsCopy,
  isNew,
  view: { repository, folder, status, error },
  timestamp,
  recoverToNewBranch,
}: GetDefaultValuesParams) {
  const annotations = meta.k8s?.annotations;
  const managerIdentity = annotations?.[AnnoKeyManagerIdentity];
  const sourcePath = annotations?.[AnnoKeySourcePath];

  if (status === RepoViewStatus.Loading) {
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

  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath];

  // The form syncs a new save's filename from its title, so seed that same name here. Falling back
  // to a timestamped placeholder would mint a fresh one on every defaults recompute, and each one
  // lands in the field for the render before the sync replaces it, which reads as a flicker.
  const titleSlug = isNew ? slugifyForFilename(defaultTitle) : undefined;

  const dashboardPath = generatePath({
    timestamp,
    pathFromAnnotation: saveAsCopy ? undefined : sourcePath,
    slug: titleSlug || (saveAsCopy ? undefined : meta.slug),
    folderPath,
  });

  // Deleted-branch recovery: the loaded ref is gone, so default to a fresh branch instead of the
  // configured one or the (gone) preview ref. Only when the repo allows branches; otherwise the
  // regular default (a write to the configured branch) is the only place the draft can go.
  const forceBranch = Boolean(recoverToNewBranch) && Boolean(repository.workflows?.includes('branch'));
  const workflow = forceBranch ? 'branch' : getDefaultWorkflow(repository, loadedFromRef);
  const ref = forceBranch ? generateNewBranchName('dashboard') : getDefaultRef(repository, 'dashboard', loadedFromRef);

  return {
    values: {
      ref,
      path: dashboardPath,
      // A new save targets whatever repository actually resolved: when the annotation hint missed,
      // the name it still carries is a repository that no longer exists
      repo: isNew ? repository.name : managerIdentity || repository.name,
      comment: '',
      folder: {
        uid: meta.folderUid,
        title: '',
      },
      title: defaultTitle,
      description: defaultDescription ?? '',
      workflow,
      copyTags: saveAsCopy ? false : true,
    },
    isNew,
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
  view: DashboardRepositoryView,
  options: {
    saveAsCopy?: boolean;
    title?: string;
    description?: string;
    recoverToNewBranch?: RecoverToNewBranch;
  } = {}
): ProvisionedDashboardData {
  const { saveAsCopy, title, description, recoverToNewBranch } = options;
  const { meta, title: dashboardTitle, description: dashboardDescription } = dashboard.useState();
  const { repository, folder, status, error, isNewSave } = view;
  const [params] = useUrlParams();
  const loadedFromRef = params.get('ref') ?? undefined;
  const gitConventionsEnabled = useBooleanFlagValue('provisioning.gitConventions', false);
  // Minted once per form: it feeds the fallback filename for a save with no title to slugify, and a
  // fresh one per recompute would rewrite that filename
  const [timestamp] = useState(generateTimestamp);
  // The caller's title is whatever the previous form showed, suffix included, so only a fresh copy gets one
  const defaultTitle = title ?? (saveAsCopy ? `${dashboardTitle} Copy` : dashboardTitle);
  const defaultDescription = description ?? dashboardDescription;

  // `view` is rebuilt on every render of the lookup; only these fields feed the defaults. A fresh values
  // object per render would re-run the form's reset effect on every drawer render
  const defaultValuesResult = useMemo(
    () =>
      getDefaultValues({
        meta,
        defaultTitle,
        defaultDescription,
        loadedFromRef,
        saveAsCopy,
        isNew: isNewSave,
        view: { repository, folder, status, error },
        timestamp,
        recoverToNewBranch,
      }),
    [
      meta,
      defaultTitle,
      defaultDescription,
      loadedFromRef,
      saveAsCopy,
      isNewSave,
      repository,
      folder,
      status,
      error,
      timestamp,
      recoverToNewBranch,
    ]
  );

  const defaultValues = useMemo(() => {
    if (defaultValuesResult.status !== RepoViewStatus.Ready) {
      return null;
    }
    const { values, repository: resolvedRepository } = defaultValuesResult;
    // When the branch name template is enforced, dashboard pushes must go through the branch workflow
    // so the templated branch is created and sent as `ref`, rather than a direct push that drops it.
    // getDefaultWorkflow stays a pure default; the enforced case is decided here at the point of use.
    // useBranchTemplate then fills the `ref`; the generated name keeps the branch default from ever
    // pointing at the configured branch in the meantime.
    return values &&
      shouldEnforceBranchTemplate(resolvedRepository, gitConventionsEnabled) &&
      values.workflow !== 'branch'
      ? { ...values, workflow: 'branch' as const, ref: generateNewBranchName('dashboard') }
      : values;
  }, [defaultValuesResult, gitConventionsEnabled]);

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

  const { isNew, repository: resolvedRepository } = defaultValuesResult;
  return {
    defaultValues,
    repository: resolvedRepository,
    loadedFromRef,
    canPushToConfiguredBranch: getCanPushToConfiguredBranch(resolvedRepository),
    isNew,
    readOnly: getIsReadOnlyRepo(resolvedRepository),
    repoDataStatus: defaultValuesResult.status,
  };
}
