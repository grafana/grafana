import { useCallback, useEffect, useRef, useState } from 'react';

import { type Folder, useLazyListFolderQuery } from 'app/api/clients/folder/v1beta1';

const FOLDER_PAGE_SIZE = 24;

export function useK8sFoldersPage() {
  const [triggerListFolders] = useLazyListFolderQuery();
  const didRequestInitialPage = useRef(false);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>(undefined);
  const [hasMoreFolders, setHasMoreFolders] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(undefined);

  const fetchMoreFolders = useCallback(async () => {
    if (isLoading || !hasMoreFolders) {
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      const response = await triggerListFolders({
        limit: FOLDER_PAGE_SIZE,
        continue: nextToken,
      }).unwrap();

      const fetchedFolders = response.items ?? [];
      const responseNextToken = response.metadata?.continue;

      setFolders((current) => current.concat(fetchedFolders));
      setNextToken(responseNextToken);
      setHasMoreFolders(Boolean(responseNextToken));
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [hasMoreFolders, isLoading, nextToken, triggerListFolders]);

  useEffect(() => {
    if (didRequestInitialPage.current) {
      return;
    }
    didRequestInitialPage.current = true;
    fetchMoreFolders();
  }, [fetchMoreFolders]);

  return {
    folders,
    hasMoreFolders,
    isLoading,
    error,
    fetchMoreFolders,
  };
}
