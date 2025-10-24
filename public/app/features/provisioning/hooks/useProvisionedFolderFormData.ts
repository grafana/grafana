import { useMemo } from 'react';

import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/provisioning/components/defaults';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { generateTimestamp } from '../components/utils/timestamp';
import { BaseProvisionedFormData } from '../types/form';

interface UseProvisionedFolderFormDataProps {
  folderUid?: string;
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
  title,
}: UseProvisionedFolderFormDataProps): ProvisionedFolderFormDataResult {
  const { repository, folder, isLoading, isReadOnlyRepo } = useGetResourceRepositoryView({ folderName: folderUid });

  const timestamp = generateTimestamp();
  const workflowOptions = getWorkflowOptions(repository);

  const initialValues = useMemo(() => {
    // Only create initial values when we have the data
    if (!repository || isLoading) {
      return undefined;
    }
    const defaultWorkflow = getDefaultWorkflow(repository);

    return {
      title: title || '',
      comment: '',
      ref: defaultWorkflow === 'branch' ? `folder/${timestamp}` : (repository?.branch ?? ''),
      repo: repository.name || '',
      path: folder?.metadata?.annotations?.[AnnoKeySourcePath] || '',
      workflow: getDefaultWorkflow(repository),
    };
  }, [repository, isLoading, title, timestamp, folder?.metadata?.annotations]);

  return {
    repository,
    folder,
    workflowOptions,
    initialValues,
    isReadOnlyRepo,
  };
}
