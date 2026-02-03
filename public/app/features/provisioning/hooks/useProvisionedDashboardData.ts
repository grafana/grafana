import { Dispatch, SetStateAction, useState } from 'react';

import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { useUrlParams } from 'app/core/navigation/hooks';
import { AnnoKeyManagerIdentity, AnnoKeyManagerKind, AnnoKeySourcePath } from 'app/features/apiserver/types';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { getIsReadOnlyRepo } from 'app/features/provisioning/utils/repository';
import { DashboardMeta } from 'app/types/dashboard';

import { getCanPushToConfiguredBranch, getDefaultWorkflow } from '../components/defaults';
import { generatePath } from '../components/utils/path';
import { generateTimestamp } from '../components/utils/timestamp';
import { ProvisionedDashboardFormData } from '../types/form';

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
  const { repository, folder, isLoading } = useGetResourceRepositoryView({
    name: managerKind === 'repo' ? managerIdentity : undefined,
    folderName: meta.folderUid,
  });

  const timestamp = generateTimestamp();
  const folderPath = folder?.metadata?.annotations?.[AnnoKeySourcePath];

  const dashboardPath = generatePath({
    timestamp,
    pathFromAnnotation: saveAsCopy ? undefined : sourcePath,
    slug: saveAsCopy ? undefined : meta.slug,
    folderPath,
  });

  const defaultWorkflow = getDefaultWorkflow(repository, loadedFromRef);

  if (isLoading || !repository) {
    return null;
  }

  return {
    values: {
      // When workflow is branch, we don't set a default ref, user will select from branches dropdown
      ref: defaultWorkflow === 'branch' ? '' : (repository?.branch ?? ''),
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
  };
}

export interface ProvisionedDashboardData {
  isReady: boolean;
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  defaultValues: ProvisionedDashboardFormData | null;
  repository?: RepositoryView;
  loadedFromRef?: string;
  isNew: boolean;
  readOnly: boolean;
  canPushToConfiguredBranch: boolean;
}

/**
 * Custom hook to fetch and prepare data for a provisioned dashboard update/delete form.
 * It retrieves default values, repository information, and workflow options based on the current dashboard state.
 */

export function useProvisionedDashboardData(dashboard: DashboardScene, saveAsCopy?: boolean): ProvisionedDashboardData {
  const { meta, title: defaultTitle, description: defaultDescription } = dashboard.useState();
  const [params] = useUrlParams();
  const [isLoading, setIsLoading] = useState(false);
  const loadedFromRef = params.get('ref') ?? undefined;

  const defaultValuesResult = useDefaultValues({
    meta,
    defaultTitle,
    defaultDescription,
    loadedFromRef,
    saveAsCopy,
  });

  if (!defaultValuesResult) {
    return {
      isReady: false,
      isLoading,
      canPushToConfiguredBranch: false,
      setIsLoading,
      defaultValues: null,
      repository: undefined,
      loadedFromRef,
      isNew: false,
      readOnly: true,
    };
  }

  const { values, isNew, repository } = defaultValuesResult;
  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);

  return {
    isReady: true,
    defaultValues: values,
    repository,
    loadedFromRef,
    canPushToConfiguredBranch,
    isNew,
    readOnly: getIsReadOnlyRepo(repository),
    isLoading,
    setIsLoading,
  };
}
