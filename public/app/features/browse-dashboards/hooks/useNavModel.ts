import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { useGetFolderCountsQuery } from 'app/api/clients/folder/v1beta1';
import {
  buildNavModel,
  getAlertingTabID,
  getLibraryPanelsTabID,
  getDashboardsTabID,
} from 'app/features/folders/state/navModel';
import type { FolderDTO } from 'app/types/folders';

/**
 * Returns a memoized nav model while also resolving counts for the tabs.
 * @param folderDTO
 * @param activeTab
 */
export function useNavModel(folderDTO: FolderDTO | undefined, activeTab: 'dashboards' | 'panels' | 'alerts') {
  const folderCountsResult = useGetFolderCountsQuery(folderDTO?.uid ? { name: folderDTO.uid } : skipToken);
  let panelsCount: number | undefined = undefined;
  let rulesCount: number | undefined = undefined;

  // The counts are not critical to have so we are not dealing with the possible api error state here, we just won't
  // show the numbers in that case.
  if (folderCountsResult.isSuccess) {
    panelsCount = folderCountsResult.data.counts.find((c) => c.resource === 'library_elements')?.count ?? 0;
    rulesCount = folderCountsResult.data.counts.find((c) => c.resource === 'alertrules')?.count ?? 0;
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
          : getAlertingTabID(folderDTO.uid);
    const tab = model.children?.find((child) => child.id === activeTabID);
    if (tab) {
      tab.active = true;
    }
    return model;
  }, [activeTab, folderDTO, panelsCount, rulesCount]);
}
