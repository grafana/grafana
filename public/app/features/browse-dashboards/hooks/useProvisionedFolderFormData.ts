import { useMemo } from 'react';

import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/dashboard-scene/saving/provisioned/defaults';
import { generateTimestamp } from 'app/features/dashboard-scene/saving/provisioned/utils/timestamp';
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
  initialValues?: BaseProvisionedFormData;
  isReadOnlyRepo: boolean;
}

/**
 * Hook for managing provisioned folder create/delete form data.
 */
export function useProvisionedFolderFormData({
  folderUid,
  action,
  title,
}: UseProvisionedFolderFormDataProps): ProvisionedFolderFormDataResult {
  const { repository, folder, isLoading, isReadOnlyRepo } = useGetResourceRepositoryView({ folderName: folderUid });

  const workflowOptions = getWorkflowOptions(repository);
  const timestamp = generateTimestamp();

  const initialValues = useMemo(() => {
    // Only create initial values when we have the data
    if (!repository || isLoading) {
      return undefined;
    }

    return {
      title: title || '',
      comment: '',
      ref: `folder/${timestamp}`,
      repo: repository.name || '',
      path: folder?.metadata?.annotations?.[AnnoKeySourcePath] || '',
      workflow: getDefaultWorkflow(repository),
    };
  }, [repository, folder, title, isLoading, timestamp]);

  return {
    repository,
    folder,
    workflowOptions,
    initialValues,
    isReadOnlyRepo,
  };
}
