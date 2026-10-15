import { createSelector } from '@reduxjs/toolkit';
import { QueryStatus } from '@reduxjs/toolkit/query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { dashboardAPIv0alpha1 } from 'app/api/clients/dashboard/v0alpha1';
import { useDispatch, useSelector } from 'app/types/store';

import { getSelectableFoldersArgs } from './utils';

type SelectableFoldersSelector = ReturnType<typeof dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.select>;
type FolderChildrenResponse = { data?: { hits: Array<{ name: string }> } };

/**
 * Checks which of each parent's loaded child folders the user can pick, once the children have loaded.
 * Returns the names that can be picked, keyed by parent UID. A parent is missing until its check has finished.
 */
export function useSelectableFolders(responseByParent: Record<string, FolderChildrenResponse>, enabled: boolean) {
  const dispatch = useDispatch();

  const [selectors, setSelectors] = useState<Record<string, SelectableFoldersSelector>>({});
  // The child names last checked per parent, so a changed response is checked again
  const requestedNamesRef = useRef<Record<string, string>>({});
  const requestsRef = useRef<Array<{ unsubscribe: () => void }>>([]);

  const selectableSelector = useMemo(() => {
    const parents = Object.keys(selectors);
    return createSelector(
      parents.map((parent) => selectors[parent]),
      (...responses) => {
        let isLoading = false;
        let error: unknown = undefined;
        const selectableByParent: Record<string, Set<string>> = {};

        responses.forEach((response, index) => {
          if (response.status === QueryStatus.pending) {
            isLoading = true;
          }
          if (!error && response.error) {
            error = response.error;
          }
          // A failed check leaves the set empty, so the folders show as read only rather than selectable
          if (response.status === QueryStatus.fulfilled || response.status === QueryStatus.rejected) {
            selectableByParent[parents[index]] = new Set(response.data?.hits.map((hit) => hit.name));
          }
        });

        return { isLoading, error, selectableByParent };
      }
    );
  }, [selectors]);

  const state = useSelector(selectableSelector);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    for (const [parentName, response] of Object.entries(responseByParent)) {
      const names = response.data?.hits.map((hit) => hit.name);
      if (!names?.length || requestedNamesRef.current[parentName] === names.join(',')) {
        continue;
      }
      requestedNamesRef.current[parentName] = names.join(',');

      const args = getSelectableFoldersArgs(names);
      const subscription = dispatch(dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.initiate(args));
      requestsRef.current = requestsRef.current.concat([subscription]);
      setSelectors((prev) => ({
        ...prev,
        [parentName]: dashboardAPIv0alpha1.endpoints.searchDashboardsAndFolders.select(args),
      }));
    }
  }, [enabled, responseByParent, dispatch]);

  useEffect(() => {
    return () => {
      for (const request of requestsRef.current) {
        request.unsubscribe();
      }
    };
  }, []);

  return state;
}
