import { useMemo } from 'react';

import { type Playlist } from 'app/api/clients/playlist/v1';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';
import {
  getCanPushToConfiguredBranch,
  getDefaultRef,
  getDefaultWorkflow,
} from 'app/features/provisioning/components/defaults';
import { useGetResourceRepositoryView } from 'app/features/provisioning/hooks/useGetResourceRepositoryView';
import { getManagerIdentity, getSourcePath } from 'app/features/provisioning/utils/managedResource';

import { type BaseProvisionedFormData } from '../types/form';

interface UseProvisionedPlaylistDataProps {
  playlist: Playlist;
  branchPrefix?: string;
}

export interface ProvisionedPlaylistDataResult {
  repository?: RepositoryView;
  canPushToConfiguredBranch: boolean;
  initialValues?: BaseProvisionedFormData;
  isReadOnlyRepo: boolean;
}

/**
 * Resolves the repository and default form values needed to commit a repository-managed
 * playlist through the provisioning save flow. The repository is looked up from the
 * playlist's manager identity annotation and the file path from its source-path annotation.
 */
export function useProvisionedPlaylistData({
  playlist,
  branchPrefix = 'playlist',
}: UseProvisionedPlaylistDataProps): ProvisionedPlaylistDataResult {
  const repositoryName = getManagerIdentity(playlist);
  const { repository, isLoading, isReadOnlyRepo } = useGetResourceRepositoryView({ name: repositoryName });

  const canPushToConfiguredBranch = getCanPushToConfiguredBranch(repository);

  const initialValues = useMemo(() => {
    // Only build initial values once the repository is resolved.
    if (!repository || isLoading) {
      return undefined;
    }
    return {
      title: playlist.spec?.title || '',
      comment: '',
      ref: getDefaultRef(repository, branchPrefix),
      repo: repository.name || '',
      path: getSourcePath(playlist) || '',
      workflow: getDefaultWorkflow(repository),
    };
  }, [repository, isLoading, playlist, branchPrefix]);

  return {
    repository,
    canPushToConfiguredBranch,
    initialValues,
    isReadOnlyRepo,
  };
}
