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

import { getCanPushToConfiguredBranch, getDefaultRef, getDefaultWorkflow } from '../components/defaults';
import { generatePath } from '../components/utils/path';
import { generateTimestamp } from '../components/utils/timestamp';
import { type ProvisionedDashboardFormData } from '../types/form';

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
  const { repository, folder, isLoading, status, error } = useGetResourceRepositoryView({
    name: managerKind === 'repo' ? managerIdentity : undefined,
    folderName: meta.folderUid,
  });

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

  const timestamp = generateTimestamp();
  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath];

  const dashboardPath = generatePath({
    timestamp,
    pathFromAnnotation: saveAsCopy ? undefined : sourcePath,
    slug: saveAsCopy ? undefined : meta.slug,
    folderPath,
  });

  return {
    values: {
      ref: getDefaultRef(repository, 'dashboard', loadedFromRef),
      path: dashboardPath,
      repo: managerIdentity || repository?.name || '',
      comment: '',
      folder: {
        uid: meta.folderUid,
        title: '',
      },
      title: saveAsCopy ? `${defaultTitle} Copy` : defaultTitle,
      description: defaultDescription ?? '',
      workflow: getDefaultWorkflow(repository, loadedFromRef),
      copyTags: saveAsCopy ? false : true,
    },
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

export function useProvisionedDashboardData(dashboard: DashboardScene, saveAsCopy?: boolean): ProvisionedDashboardData {
  const { meta, title: defaultTitle, description: defaultDescription } = dashboard.useState();
  const [params] = useUrlParams();
  const loadedFromRef = params.get('ref') ?? undefined;

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

  return {
    defaultValues: values,
    repository,
    loadedFromRef,
    canPushToConfiguredBranch,
    isNew,
    readOnly: getIsReadOnlyRepo(repository),
    repoDataStatus: defaultValuesResult.status,
  };
}
