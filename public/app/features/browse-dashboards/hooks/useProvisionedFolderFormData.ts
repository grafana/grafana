import { useEffect } from 'react';
import { UseFormReset } from 'react-hook-form';

import { Folder } from 'app/api/clients/folder/v1beta1';
import { RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import { getDefaultWorkflow, getWorkflowOptions } from 'app/features/dashboard-scene/saving/provisioned/defaults';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { BaseProvisionedFormData } from '../../dashboard-scene/saving/shared';

export interface UseProvisionedFolderFormDataProps {
  folderUid?: string;
  action: 'create' | 'delete';
  reset?: UseFormReset<BaseProvisionedFormData>;
  title?: string;
}

export interface ProvisionedFolderFormDataResult {
  repository?: RepositoryView;
  folder?: Folder;
  workflowOptions: Array<{ label: string; value: string }>;
  isGitHub: boolean;
}

/**
 * Hook for managing provisioned folder create/delete form data.
 */
export function useProvisionedFolderFormData({
  folderUid,
  action,
  reset,
  title,
}: UseProvisionedFolderFormDataProps): ProvisionedFolderFormDataResult {
  const { repository, folder } = useGetResourceRepositoryView({ folderName: folderUid });

  const workflowOptions = getWorkflowOptions(repository);
  const isGitHub = Boolean(repository?.type === 'github');

  useEffect(() => {
    // initialize form values
    if (folder && repository && reset) {
      const formValues: BaseProvisionedFormData = {
        title: title || '',
        comment: '',
        ref: `${action}-folder-${Date.now()}`,
        repo: repository.name || '',
        path: folder?.metadata?.annotations?.[AnnoKeySourcePath] || '',
        workflow: getDefaultWorkflow(repository),
      };
      reset(formValues);
    }
  }, [folder, repository, reset, title, action]);

  return {
    repository,
    folder,
    workflowOptions,
    isGitHub,
  };
}
