import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useRef } from 'react';

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

import {
  getCanPushToConfiguredBranch,
  getDefaultRef,
  getDefaultWorkflow,
  shouldEnforceBranchTemplate,
} from '../components/defaults';
import { generatePath, slugifyForFilename } from '../components/utils/path';
import { generateTimestamp } from '../components/utils/timestamp';
import { type ProvisionedDashboardFormData } from '../types/form';

// A save-as copy writes a new file even though the source dashboard already exists.
export function getIsNewDashboardSave(meta: DashboardMeta, saveAsCopy?: boolean) {
  return !meta.k8s?.name || Boolean(saveAsCopy);
}

interface UseDefaultValuesParams {
  meta: DashboardMeta;
  defaultTitle: string;
  defaultDescription?: string;
  loadedFromRef?: string;
  saveAsCopy?: boolean;
}

export function useDefaultValues({
  meta,
  defaultTitle,
  defaultDescription,
  loadedFromRef,
  saveAsCopy,
}: UseDefaultValuesParams) {
  const annotations = meta.k8s?.annotations;
  const managerKind = annotations?.[AnnoKeyManagerKind];
  const managerIdentity = annotations?.[AnnoKeyManagerIdentity];
  const sourcePath = annotations?.[AnnoKeySourcePath];
  const isNew = getIsNewDashboardSave(meta, saveAsCopy);
  const { repository, folder, isLoading, status, error } = useGetResourceRepositoryView({
    name: managerKind === 'repo' ? managerIdentity : undefined,
    folderName: meta.folderUid,
    includeFolderless: !meta.folderUid && isNew,
    // A new save owns no file yet, so its manager annotation is only a hint. Resolving it the same
    // way useIsProvisionedNG does keeps the two from disagreeing over whether this is provisioned,
    // which is what left the drawer rendering the provisioned branch around an orphan notice.
    nameIsHint: isNew,
  });
  // Minted once per form rather than per render: this feeds the fallback filename for a save with
  // no title to slugify, and regenerating it would rewrite that filename on every recompute
  const timestampRef = useRef<string>(undefined);
  timestampRef.current ??= generateTimestamp();
  const timestamp = timestampRef.current;

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

  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath];

  const formTitle = saveAsCopy ? `${defaultTitle} Copy` : defaultTitle;
  // The form syncs a new save's filename from its title, so seed that same name here. Falling back
  // to a timestamped placeholder would mint a fresh one on every defaults recompute, and each one
  // lands in the field for the render before the sync replaces it, which reads as a flicker.
  const titleSlug = isNew ? slugifyForFilename(formTitle ?? '') : undefined;

  const dashboardPath = generatePath({
    timestamp,
    pathFromAnnotation: saveAsCopy ? undefined : sourcePath,
    slug: titleSlug || (saveAsCopy ? undefined : meta.slug),
    folderPath,
  });

  return {
    values: {
      ref: getDefaultRef(repository, 'dashboard', loadedFromRef),
      path: dashboardPath,
      // A new save targets whatever repository actually resolved: when the annotation hint missed,
      // the name it still carries is a repository that no longer exists
      repo: (isNew ? repository.name : managerIdentity || repository.name) ?? '',
      comment: '',
      folder: {
        uid: meta.folderUid,
        title: '',
      },
      title: formTitle,
      description: defaultDescription ?? '',
      workflow: getDefaultWorkflow(repository, loadedFromRef),
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

export function useProvisionedDashboardData(dashboard: DashboardScene, saveAsCopy?: boolean): ProvisionedDashboardData {
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
  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);

  // When the branch name template is enforced, dashboard pushes must go through the branch workflow
  // so the templated branch is created and sent as `ref`, rather than a direct push that drops it.
  // getDefaultWorkflow stays a pure default; the enforced case is decided here at the point of use.
  // useBranchTemplate then fills the `ref`.
  const defaultValues =
    values && shouldEnforceBranchTemplate(repository, gitConventionsEnabled) && values.workflow !== 'branch'
      ? { ...values, workflow: 'branch' as const }
      : values;

  return {
    defaultValues,
    repository,
    loadedFromRef,
    canPushToConfiguredBranch,
    isNew,
    readOnly: getIsReadOnlyRepo(repository),
    repoDataStatus: defaultValuesResult.status,
  };
}
