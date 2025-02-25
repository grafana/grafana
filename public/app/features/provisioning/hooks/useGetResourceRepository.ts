import { skipToken } from '@reduxjs/toolkit/query/react';

import { useGetFolderQuery } from '../../browse-dashboards/api/browseDashboardsAPI';

import { useRepositoryList } from './useRepositoryList';

interface GetResourceRepositoryArgs {
  name?: string;
  folderUid?: string;
}

export const useGetResourceRepository = ({ name, folderUid }: GetResourceRepositoryArgs) => {
  const [items, isLoading] = useRepositoryList();
  // Get the folder data from API to get repository data for nested folders
  const folderQuery = useGetFolderQuery(name || !folderUid ? skipToken : folderUid);

  const repoName = name || folderQuery.data?.repository?.name;

  if (!items?.length || isLoading || !repoName) {
    return undefined;
  }

  return items.find((repo) => repo.metadata?.name === repoName);
}; 
