import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { getIsReadOnlyRepo } from 'app/features/provisioning/utils/repository';
import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../../state/hooks';
import { findItem } from '../../state/utils';
import { DashboardTreeSelection } from '../../types';
import { getItemRepositoryUid } from '../utils';

// This hook is responsible for validating if all selected resources (dashboard folders and dashboards) are in the same repository
export function useSelectionRepoValidation(selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>) {
  const provisioningEnabled = config.featureToggles.provisioning;
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector)?.items ?? [];

  const { data: settingsData } = useGetFrontendSettingsQuery(!provisioningEnabled ? skipToken : undefined);
  // Function to grab repository configuration by UID
  const getRepositoryByUid = (repoUid: string) => {
    if (!settingsData?.items || repoUid === 'non_provisioned') {
      return undefined;
    }
    return settingsData.items.find((repo) => repo.name === repoUid);
  };

  const getRepoUid = (uid: string) => {
    const item = findItem(rootItems, childrenByParentUID, uid);
    return item ? getItemRepositoryUid(item, rootItems, childrenByParentUID) : 'non_provisioned';
  };

  const selectedUIDs = [
    ...Object.keys(selectedItems.folder || {}).filter((id) => selectedItems.folder[id]),
    ...Object.keys(selectedItems.dashboard || {}).filter((id) => selectedItems.dashboard[id]),
  ];

  const repoUIDs = selectedUIDs.map(getRepoUid).filter((repoId): repoId is string => !!repoId);

  const selectedItemsRepoUID = repoUIDs.length > 0 ? repoUIDs[0] : undefined;
  const isCrossRepo = new Set(repoUIDs).size > 1;

  const isInLockedRepo = (uid: string) => !selectedItemsRepoUID || getRepoUid(uid) === selectedItemsRepoUID;
  const isUidInReadOnlyRepo = (uid: string) => {
    const repo = getRepositoryByUid(getRepoUid(uid));
    return repo ? getIsReadOnlyRepo(repo) : false;
  };

  return {
    selectedItemsRepoUID,
    isInLockedRepo,
    isCrossRepo, // true if items are from different repositories
    isUidInReadOnlyRepo,
  };
}
