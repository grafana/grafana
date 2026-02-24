import { useMemo } from 'react';

import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { getCanPushToConfiguredBranch, getDefaultWorkflow } from 'app/features/provisioning/components/defaults';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { BaseProvisionedFormData } from '../types/form';

interface UseProvisionedFolderFormDataProps {
  folderUid?: string;
  title?: string;
}

export interface ProvisionedFolderFormDataResult {
  repository?: RepositoryView;
  folder?: Folder;
  canPushToConfiguredBranch: boolean;
  initialValues?: BaseProvisionedFormData;
  isReadOnlyRepo: boolean;
}

/**
 * Hook for managing provisioned folder create/delete form data.
 */
export function useProvisionedFolderFormData({
  folderUid,
  title,
}: UseProvisionedFolderFormDataProps): ProvisionedFolderFormDataResult {
  const { repository, folder, isLoading, isReadOnlyRepo } = useGetResourceRepositoryView({ folderName: folderUid });

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);

  const initialValues = useMemo(() => {
    // Only create initial values when we have the data
    if (!repository || isLoading) {
      return undefined;
    }
    const defaultWorkflow = getDefaultWorkflow(repository);

    return {
      title: title || '',
      comment: '',
      // When workflow is branch, we don't set a default ref, user will select from branches dropdown
      ref: defaultWorkflow === 'branch' ? '' : (repository?.branch ?? ''),
      repo: repository.name || '',
      path: folder?.metadata?.annotations?.[AnnoKeySourcePath] || '',
      workflow: getDefaultWorkflow(repository),
    };
  }, [repository, isLoading, title, folder?.metadata?.annotations]);

  return {
    repository,
    folder,
    canPushToConfiguredBranch,
    initialValues,
    isReadOnlyRepo,
  };
}
