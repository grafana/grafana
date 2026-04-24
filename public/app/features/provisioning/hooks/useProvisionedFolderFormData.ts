import { useMemo } from 'react';

import { type Folder } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import {
  getCanPushToConfiguredBranch,
  getDefaultRef,
  getDefaultWorkflow,
} from 'app/features/provisioning/components/defaults';
import { ensureFolderPathTrailingSlash } from 'app/features/provisioning/components/utils/path';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';

import { type BaseProvisionedFormData } from '../types/form';

interface UseProvisionedFolderFormDataProps {
  folderUid?: string;
  title?: string;
  branchPrefix?: string;
}

export interface ProvisionedFolderFormDataResult {
  repository?: RepositoryView;
  folder?: Folder;
  canPushToConfiguredBranch: boolean;
  initialValues?: BaseProvisionedFormData;
  isReadOnlyRepo: boolean;
}

/**
 * Hook for managing provisioned folder form data (create/rename/delete).
 */
export function useProvisionedFolderFormData({
  folderUid,
  title,
  branchPrefix = 'folder',
}: UseProvisionedFolderFormDataProps): ProvisionedFolderFormDataResult {
  const { repository, folder, isLoading, isReadOnlyRepo } = useGetResourceRepositoryView({ folderName: folderUid });

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);

  const initialValues = useMemo(() => {
    // Only create initial values when we have the data
    if (!repository || isLoading) {
      return undefined;
    }
    return {
      title: title || '',
      comment: '',
      ref: getDefaultRef(repository, branchPrefix),
      repo: repository.name || '',
      path: ensureFolderPathTrailingSlash(folder?.metadata?.annotations?.[AnnoKeySourcePath] || ''),
      workflow: getDefaultWorkflow(repository),
    };
  }, [repository, isLoading, title, folder?.metadata?.annotations, branchPrefix]);

  return {
    repository,
    folder,
    canPushToConfiguredBranch,
    initialValues,
    isReadOnlyRepo,
  };
}
