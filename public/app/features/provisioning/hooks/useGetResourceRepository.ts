import { skipToken } from '@reduxjs/toolkit/query/react';

import { useGetFolderQuery } from '../../../api/clients/folder';
import { AnnoKeyManagerKind } from '../../apiserver/types';

import { useRepositoryList } from './useRepositoryList';

interface GetResourceRepositoryArgs {
  name?: string;
  folderUid?: string;
}

export const useGetResourceRepository = ({ name, folderUid }: GetResourceRepositoryArgs) => {
  const [items, isLoading] = useRepositoryList(name || !folderUid ? skipToken : undefined);
  // Get the folder data from API to get the repository data for nested folders
  const folderQuery = useGetFolderQuery(name || !folderUid ? skipToken : { name: folderUid });

  const repoName = name || folderQuery.data?.metadata?.annotations?.[AnnoKeyManagerKind];

  if (!items?.length || isLoading || !repoName) {
    return undefined;
  }

  return items.find((repo) => repo.metadata?.name === repoName);
};
