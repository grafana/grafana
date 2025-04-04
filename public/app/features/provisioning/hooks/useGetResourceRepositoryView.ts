import { skipToken } from '@reduxjs/toolkit/query/react';

import { RepositoryView, useGetFrontendSettingsQuery } from 'app/api/clients/provisioning';

import { useGetFolderQuery } from '../../../api/clients/folder';
import { AnnoKeyManagerIdentity } from '../../apiserver/types';

interface GetResourceRepositoryArgs {
  name?: string; // the repository name
  folderUid?: string; // folder we are targeting
}

// This is safe to call as a viewer (you do not need full access to the Repository configs)
export const useGetResourceRepositoryView = ({ name, folderUid }: GetResourceRepositoryArgs): RepositoryView | null => {
  const settings = useGetFrontendSettingsQuery();
  const folderQuery = useGetFolderQuery(name || !folderUid ? skipToken : { name: folderUid });

  if (!settings.data?.items) {
    return null;
  }

  if (name) {
    const selectedConfig = settings.data.items.find((repo) => repo.name === name);
    if (selectedConfig) {
      return selectedConfig;
    }
  }

  // Find the matching folder repository
  if (folderUid) {
    // For root values it will be the same
    let folderConfig = settings.data.items.find((repo) => repo.name === folderUid);
    if (folderConfig) {
      return folderConfig;
    }

    // For nested folders we need to see what the folder thinks
    folderUid = folderQuery.data?.metadata?.annotations?.[AnnoKeyManagerIdentity];
    if (name) {
      folderConfig = settings.data.items.find((repo) => repo.name === folderUid);
      if (folderConfig) {
        return folderConfig;
      }
    }
  }

  // When an instance is configured -- always use that
  const instanceConfig = settings.data.items.find((repo) => repo.target === 'instance');
  if (instanceConfig) {
    return instanceConfig;
  }

  return null;
};
