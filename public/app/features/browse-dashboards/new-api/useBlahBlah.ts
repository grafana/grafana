import { useMultipleQueries } from './useMultipleQueries';

import { FolderSearchHit, GetFoldersApiArg, newBrowseDashboardsAPI } from '.';

// interface NewBrowseItem  {}

interface UseNewAPIBlahBlahPayload {
  items: FolderSearchHit[];
  isLoading: boolean;
  hasNextPage: boolean;
  requestNextPage: (args: GetFoldersApiArg) => void;
}

export function useNewAPIBlahBlah(): UseNewAPIBlahBlahPayload {
  const [folderPages, requestFolderPage] = useMultipleQueries(newBrowseDashboardsAPI.endpoints.getFolders);

  const isLoading = folderPages.some((page) => page.isLoading);
  const items = folderPages.flatMap((page) => page.data ?? []);

  const lastLoadedPage = folderPages.findLast((page) => page.status === 'fulfilled');
  const lastPageIsEmpty = lastLoadedPage ? lastLoadedPage.data?.length === 0 : false;

  return {
    items: items,
    isLoading: isLoading,
    hasNextPage: !lastPageIsEmpty,
    requestNextPage: requestFolderPage,
  };
}
