import { useCallback, useEffect, useState } from 'react';

import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { DashboardQueryResult } from 'app/features/search/service/types';

interface UseAlertingFoldersResult {
  folders: DashboardQueryResult[];
  isLoading: boolean;
  hasMore: boolean;
  fetchMore: () => void;
  error?: Error;
}

const FOLDERS_PAGE_SIZE = 40;

/**
 * Hook to fetch folders using the search API.
 * Folders are fetched lazily with pagination support.
 * Note: This fetches all folders, not just those containing alert rules.
 * Empty folders will show no groups when expanded.
 */
export function useAlertingFolders(): UseAlertingFoldersResult {
  const [folders, setFolders] = useState<DashboardQueryResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<Error>();
  const [page, setPage] = useState(0);

  const fetchFolders = useCallback(
    async (pageToFetch: number) => {
      if (!hasMore && pageToFetch > 0) {
        return;
      }

      setIsLoading(true);
      setError(undefined);

      try {
        const searcher = getGrafanaSearcher();
        const response = await searcher.search({
          kind: ['folder'],
          limit: FOLDERS_PAGE_SIZE,
          from: pageToFetch * FOLDERS_PAGE_SIZE,
        });

        const newFolders = response.view.toArray();
        setFolders((prev) => (pageToFetch === 0 ? newFolders : [...prev, ...newFolders]));
        setHasMore(newFolders.length === FOLDERS_PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch folders'));
      } finally {
        setIsLoading(false);
      }
    },
    [hasMore]
  );

  const fetchMore = useCallback(() => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFolders(nextPage);
  }, [page, fetchFolders]);

  // Initial fetch
  useEffect(() => {
    fetchFolders(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    folders,
    isLoading,
    hasMore,
    fetchMore,
    error,
  };
}
