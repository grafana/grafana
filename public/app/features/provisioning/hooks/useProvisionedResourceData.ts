import { useMemo } from 'react';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import {
  getCanPushToConfiguredBranch,
  getDefaultRef,
  getDefaultWorkflow,
} from 'app/features/provisioning/components/defaults';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import {
  getManagerIdentity,
  getSourcePath,
  type ManagedResource,
} from 'app/features/provisioning/utils/managedResource';

import { type BaseProvisionedFormData } from '../types/form';

interface UseProvisionedResourceDataProps {
  /** Any k8s-style resource exposing `metadata.annotations` (playlist, library panel, ...). */
  resource: ManagedResource;
  /** Human-readable title used to seed the form (commit message / banners). */
  title?: string;
  branchPrefix?: string;
}

export interface ProvisionedResourceDataResult {
  repository?: RepositoryView;
  canPushToConfiguredBranch: boolean;
  initialValues?: BaseProvisionedFormData;
  isReadOnlyRepo: boolean;
}

/**
 * Resolves the repository and default form values needed to commit a repository-managed
 * resource through the provisioning save flow. The repository is looked up from the
 * resource's manager-identity annotation and the file path from its source-path annotation,
 * so it works for any resource type (playlists, library panels, ...) without changes.
 */
export function useProvisionedResourceData({
  resource,
  title,
  branchPrefix = 'resource',
}: UseProvisionedResourceDataProps): ProvisionedResourceDataResult {
  const repositoryName = getManagerIdentity(resource);
  const { repository, isLoading, isReadOnlyRepo } = useGetResourceRepositoryView({ name: repositoryName });

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);

  const sourcePath = getSourcePath(resource);
  const initialValues = useMemo(() => {
    // Only build initial values once the repository is resolved.
    if (!repository || isLoading) {
      return undefined;
    }
    return {
      title: title || '',
      comment: '',
      ref: getDefaultRef(repository, branchPrefix),
      repo: repository.name || '',
      path: sourcePath || '',
      workflow: getDefaultWorkflow(repository),
    };
  }, [repository, isLoading, title, sourcePath, branchPrefix]);

  return {
    repository,
    canPushToConfiguredBranch,
    initialValues,
    isReadOnlyRepo,
  };
}
