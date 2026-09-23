import { skipToken } from '@reduxjs/toolkit/query';
import { createSelector } from 'reselect';

import { config } from '@grafana/runtime';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import {
  childrenByParentUIDSelector,
  rootItemsSelector,
  useChildrenByParentUIDState,
} from 'app/features/browse-dashboards/state/hooks';
import { findItem } from 'app/features/browse-dashboards/state/utils';
import { type DashboardTreeSelection } from 'app/features/browse-dashboards/types';
import { getSelectedItemRefs } from 'app/features/browse-dashboards/utils/dashboards';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { getIsReadOnlyRepo, getItemRepositoryUid } from 'app/features/provisioning/utils/repository';
import { type DashboardViewItem } from 'app/features/search/types';
import { type StoreState, useSelector } from 'app/types/store';

type SelectedItems = Omit<DashboardTreeSelection, 'panel' | '$all'>;

// Resolving every selected item's repository walks the browse tree, so it is memoized per selection instead of
// being recomputed by each row's checkbox.
const selectionRepoSelector = createSelector(
  rootItemsSelector,
  childrenByParentUIDSelector,
  (state: StoreState, selectedItems: SelectedItems) => selectedItems,
  (rootCollection, childrenByParentUID, selectedItems) => {
    const rootItems = rootCollection?.items ?? [];
    const repoUIDs = getSelectedItemRefs(selectedItems).map(({ kind, uid }) => {
      const item = findItem(rootItems, childrenByParentUID, kind, uid);
      return item ? getItemRepositoryUid(item, rootItems, childrenByParentUID) : 'non_provisioned';
    });

    return {
      // Skip 'non_provisioned' sentinel so downstream queries don't fire against a non-existent folder
      selectedItemsRepoUID: repoUIDs.find((uid) => uid !== 'non_provisioned'),
      isCrossRepo: new Set(repoUIDs).size > 1,
      hasSelection: repoUIDs.length > 0,
    };
  }
);

// This hook is responsible for validating if all selected resources (dashboard folders and dashboards) are in the same repository
export function useSelectionRepoValidation(selectedItems: SelectedItems) {
  const provisioningEnabled = config.provisioningEnabled;
  const childrenByParentUID = useChildrenByParentUIDState();
  const rootItems = useSelector(rootItemsSelector)?.items ?? [];
  const isProvisionedInstance = useIsProvisionedInstance();
  const { selectedItemsRepoUID, isCrossRepo, hasSelection } = useSelector((state) =>
    selectionRepoSelector(state, selectedItems)
  );

  const { data: settingsData } = useGetFrontendSettingsQuery(!provisioningEnabled ? skipToken : undefined);
  // Function to grab repository configuration by UID
  const getRepositoryByUid = (repoUid: string) => {
    if (!settingsData?.items || repoUid === 'non_provisioned') {
      return undefined;
    }
    return settingsData.items.find((repo) => repo.name === repoUid);
  };

  const getItemRepoUid = (item: DashboardViewItem) => getItemRepositoryUid(item, rootItems, childrenByParentUID);

  const isInLockedRepo = (item: DashboardViewItem) => {
    // if whole instance is provisioned, all items are considered in the locked (same) repo
    if (isProvisionedInstance) {
      return true;
    }
    if (!selectedItemsRepoUID) {
      // No provisioned repo in selection — if nothing is selected allow any item,
      // otherwise lock to non-provisioned only so provisioned items can't be mixed in
      return !hasSelection || getItemRepoUid(item) === 'non_provisioned';
    }
    return getItemRepoUid(item) === selectedItemsRepoUID;
  };
  const isItemInReadOnlyRepo = (item: DashboardViewItem) => {
    const repo = getRepositoryByUid(getItemRepoUid(item));
    return repo ? getIsReadOnlyRepo(repo) : false;
  };

  return {
    selectedItemsRepoUID,
    isInLockedRepo,
    isCrossRepo, // true if items are from different repositories
    isItemInReadOnlyRepo,
  };
}
