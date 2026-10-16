import { createSelector } from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { useDispatch, useSelector } from 'app/types/store';

import { getSelectableFoldersArgs } from './utils';

type SelectableFoldersSelector = ReturnType<typeof dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.select>;
type FolderChildrenResponse = { data?: { hits: Array<{ name: string }> } };

/**
 * Checks which folders in each loaded response the user can pick, once the response has loaded.
 * Returns the names that can be picked, keyed like the responses. A key is missing until its check has finished.
 */
export function useSelectableFolders(responsesByKey: Record<string, FolderChildrenResponse>, enabled: boolean) {
  const dispatch = useDispatch();

  const [selectors, setSelectors] = useState<Record<string, SelectableFoldersSelector>>({});
  // The names last checked per key, so a changed response is checked again
  const requestedNamesRef = useRef<Record<string, string>>({});
  const requestsRef = useRef<Array<{ unsubscribe: () => void }>>([]);

  const selectableSelector = useMemo(() => {
    const keys = Object.keys(selectors);
    return createSelector(
      keys.map((key) => selectors[key]),
      (...responses) => {
        let isLoading = false;
        let error: unknown = undefined;
        const selectableByKey: Record<string, Set<string>> = {};

        responses.forEach((response, index) => {
          if (response.status === QueryStatus.pending) {
            isLoading = true;
          }
          if (!error && response.error) {
            error = response.error;
          }
          // A failed check leaves the set empty, so the folders show as read only rather than selectable
          if (response.status === QueryStatus.fulfilled || response.status === QueryStatus.rejected) {
            selectableByKey[keys[index]] = new Set(response.data?.hits.map((hit) => hit.name));
          }
        });

        return { isLoading, error, selectableByKey };
      }
    );
  }, [selectors]);

  const state = useSelector(selectableSelector);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    for (const [key, response] of Object.entries(responsesByKey)) {
      const names = response.data?.hits.map((hit) => hit.name);
      if (!names?.length || requestedNamesRef.current[key] === names.join(',')) {
        continue;
      }
      requestedNamesRef.current[key] = names.join(',');

      const args = getSelectableFoldersArgs(names);
      const subscription = dispatch(dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.initiate(args));
      requestsRef.current = requestsRef.current.concat([subscription]);
      setSelectors((prev) => ({
        ...prev,
        [key]: dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.select(args),
      }));
    }
  }, [enabled, responsesByKey, dispatch]);

  useEffect(() => {
    return () => {
      for (const request of requestsRef.current) {
        request.unsubscribe();
      }
    };
  }, []);

  return state;
}
