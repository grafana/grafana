import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { useGetFolderCountsQuery } from 'app/api/clients/folder/v1beta1';
import { getParsedCounts } from 'app/api/clients/folder/v1beta1/utils';
import {
  buildNavModel,
  getAlertingTabID,
  getLibraryPanelsTabID,
  getDashboardsTabID,
  getVariablesTabID,
} from 'app/features/folders/state/navModel';
import type { FolderDTO } from 'app/types/folders';

export type FolderActiveTab = 'dashboards' | 'panels' | 'alerts' | 'variables';

/**
 * Returns a memoized nav model while also resolving counts for the tabs.
 */
export function useNavModel(folderDTO: FolderDTO | undefined, activeTab: FolderActiveTab) {
  const folderCountsResult = useGetFolderCountsQuery(folderDTO?.uid ? { name: folderDTO.uid } : skipToken, {
    // Always refetch the counts as we don't have a way to invalidate the cache when descendant resources are
    // created or deleted because they are in separate RTK slices.
    refetchOnMountOrArgChange: true,
  });
  let panelsCount: number | undefined = undefined;
  let rulesCount: number | undefined = undefined;

  // The counts are not critical to have so we are not dealing with the possible api error state here, we just won't
  // show the numbers in that case.
  if (folderCountsResult.isSuccess) {
    const counts = getParsedCounts(folderCountsResult.data.counts);
    panelsCount = counts.librarypanels ?? 0;
    rulesCount = counts.alertrules ?? 0;
  }

  return useMemo(() => {
    if (!folderDTO) {
      return undefined;
    }
    const model = buildNavModel(
      folderDTO,
      undefined,
      panelsCount !== undefined && rulesCount !== undefined ? { panels: panelsCount, rules: rulesCount } : undefined
    );

    const activeTabID =
      activeTab === 'dashboards'
        ? getDashboardsTabID(folderDTO.uid)
        : activeTab === 'panels'
          ? getLibraryPanelsTabID(folderDTO.uid)
          : activeTab === 'variables'
            ? getVariablesTabID(folderDTO.uid)
            : getAlertingTabID(folderDTO.uid);
    const tab = model.children?.find((child) => child.id === activeTabID);
    if (tab) {
      tab.active = true;
    }
    return model;
  }, [activeTab, folderDTO, panelsCount, rulesCount]);
}
