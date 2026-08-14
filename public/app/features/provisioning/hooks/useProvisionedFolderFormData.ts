import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { useMemo } from 'react';

import { type Folder } from 'app/api/clients/folder/v1beta1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import { AnnoKeySourcePath } from 'app/features/apiserver/types';
import {
  getCanPushToConfiguredBranch,
  getDefaultRef,
  getDefaultWorkflow,
  shouldEnforceBranchTemplate,
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
  isLoading: boolean;
  /** True when loading has settled and no repository could be resolved. See useGetResourceRepositoryView. */
  isMissingRepo: boolean;
}

/**
 * Hook for managing provisioned folder form data (create/rename/delete).
 */
export function useProvisionedFolderFormData({
  folderUid,
  title,
  branchPrefix = 'folder',
}: UseProvisionedFolderFormDataProps): ProvisionedFolderFormDataResult {
  const { repository, folder, isLoading, isReadOnlyRepo, isMissingRepo } = useGetResourceRepositoryView({
    folderName: folderUid,
  });
  const gitConventionsEnabled = useBooleanFlagValue('provisioning.gitConventions', false);

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);

  const initialValues = useMemo(() => {
    // Only create initial values when we have the data
    if (!repository || isLoading) {
      return undefined;
    }
    // When the branch name template is enforced, folder pushes must use the branch workflow so the
    // templated branch is created and sent as `ref`. getDefaultWorkflow stays a pure default; the
    // enforced case is decided here at the point of use.
    return {
      title: title || '',
      comment: '',
      ref: getDefaultRef(repository, branchPrefix),
      repo: repository.name || '',
      path: ensureFolderPathTrailingSlash(folder?.metadata?.annotations?.[AnnoKeySourcePath] || ''),
      workflow: shouldEnforceBranchTemplate(repository, gitConventionsEnabled)
        ? ('branch' as const)
        : getDefaultWorkflow(repository),
    };
  }, [repository, isLoading, title, folder?.metadata?.annotations, branchPrefix, gitConventionsEnabled]);

  return {
    repository,
    folder,
    canPushToConfiguredBranch,
    initialValues,
    isReadOnlyRepo,
    isLoading: Boolean(isLoading),
    isMissingRepo,
  };
}
