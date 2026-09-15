import { skipToken } from '@reduxjs/toolkit/query';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { findItem } from 'app/features/browse-dashboards/state/utils';
import { type DashboardTreeSelection } from 'app/features/browse-dashboards/types';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { getIsReadOnlyRepo, getItemRepositoryUid } from 'app/features/provisioning/utils/repository';
import { type DashboardViewItemKind } from 'app/features/search/types';
import { useSelector } from 'app/types/store';

import { useChildrenByParentUIDState, rootItemsSelector } from '../../browse-dashboards/state/hooks';

// This hook is responsible for validating if all selected resources (dashboard folders and dashboards) are in the same repository
export function useSelectionRepoValidation(selectedItems: Omit<DashboardTreeSelection, 'panel' | '$all'>) {
  const provisioningEnabled = config.provisioningEnabled;
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector)?.items ?? [];
  const isProvisionedInstance = useIsProvisionedInstance();

  const { data: settingsData } = useGetFrontendSettingsQuery(!provisioningEnabled ? skipToken : undefined);
  // Function to grab repository configuration by UID
  const getRepositoryByUid = (repoUid: string) => {
    if (!settingsData?.items || repoUid === 'non_provisioned') {
      return undefined;
    }
    return settingsData.items.find((repo) => repo.name === repoUid);
  };

  const getRepoUid = (kind: DashboardViewItemKind, uid: string) => {
    const item = findItem(rootItems, childrenByParentUID, kind, uid);
    return item ? getItemRepositoryUid(item, rootItems, childrenByParentUID) : 'non_provisioned';
  };

  const repoUIDs = [
    ...Object.keys(selectedItems.folder || {})
      .filter((uid) => selectedItems.folder[uid])
      .map((uid) => getRepoUid('folder', uid)),
    ...Object.keys(selectedItems.dashboard || {})
      .filter((uid) => selectedItems.dashboard[uid])
      .map((uid) => getRepoUid('dashboard', uid)),
  ];

  // Skip 'non_provisioned' sentinel so downstream queries don't fire against a non-existent folder
  const selectedItemsRepoUID = repoUIDs.find((uid) => uid !== 'non_provisioned');
  const isCrossRepo = new Set(repoUIDs).size > 1;

  const hasSelection = repoUIDs.length > 0;

  const isInLockedRepo = (kind: DashboardViewItemKind, uid: string) => {
    // if whole instance is provisioned, all items are considered in the locked (same) repo
    if (isProvisionedInstance) {
      return true;
    }
    if (!selectedItemsRepoUID) {
      // No provisioned repo in selection — if nothing is selected allow any item,
      // otherwise lock to non-provisioned only so provisioned items can't be mixed in
      return !hasSelection || getRepoUid(kind, uid) === 'non_provisioned';
    }
    return getRepoUid(kind, uid) === selectedItemsRepoUID;
  };
  const isUidInReadOnlyRepo = (kind: DashboardViewItemKind, uid: string) => {
    const repo = getRepositoryByUid(getRepoUid(kind, uid));
    return repo ? getIsReadOnlyRepo(repo) : false;
  };

  return {
    selectedItemsRepoUID,
    isInLockedRepo,
    isCrossRepo, // true if items are from different repositories
    isUidInReadOnlyRepo,
  };
}
