import { useMemo } from 'react';

import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/dashboard-scene/saving/provisioned/defaults';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { BaseProvisionedFormData } from '../../dashboard-scene/saving/shared';

export interface UseProvisionedFolderFormDataProps {
  folderUid?: string;
  action: 'create' | 'delete';
  title?: string;
}

export interface ProvisionedFolderFormDataResult {
  repository?: RepositoryView;
  folder?: Folder;
  workflowOptions: Array<{ label: string; value: string }>;
  isGitHub: boolean;
  initialValues?: BaseProvisionedFormData;
}

/**
 * Hook for managing provisioned folder create/delete form data.
 */
export function useProvisionedFolderFormData({
  folderUid,
  action,
  title,
}: UseProvisionedFolderFormDataProps): ProvisionedFolderFormDataResult {
  const { repository, folder, isLoading } = useGetResourceRepositoryView({ folderName: folderUid });

  const workflowOptions = getWorkflowOptions(repository);
  const isGitHub = Boolean(repository?.type === 'github');

  const initialValues = useMemo(() => {
    // Only create initial values when we have the data
    if (!repository || !folder || isLoading) {
      return undefined;
    }

    return {
      title: title || '',
      comment: '',
      ref: `${action}-folder-${Date.now()}`,
      repo: repository.name || '',
      path: folder?.metadata?.annotations?.[AnnoKeySourcePath] || '',
      workflow: getDefaultWorkflow(repository),
    };
  }, [repository, folder, title, action, isLoading]);

  return {
    repository,
    folder,
    workflowOptions,
    isGitHub,
    initialValues,
  };
}
