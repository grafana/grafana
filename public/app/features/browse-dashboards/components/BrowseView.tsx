import { skipToken } from '@reduxjs/toolkit/query';
import { useCallback, useMemo } from 'react';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { CallToActionCard, EmptyState, LinkButton, TextLink } from '@grafana/ui';
import { useGetFrontendSettingsQuery } from 'app/api/clients/provisioning/v0alpha1';
import { useIsProvisionedInstance } from 'app/features/provisioning/hooks/useIsProvisionedInstance';
import { DashboardViewItem } from 'app/features/search/types';
import { useDispatch } from 'app/types/store';

import { PAGE_SIZE } from '../api/services';
import { fetchNextChildrenPage } from '../state/actions';
import {
  useFlatTreeState,
  useCheckboxSelectionState,
  useChildrenByParentUIDState,
  useBrowseLoadingStatus,
  useLoadNextChildrenPage,
} from '../state/hooks';
import { setFolderOpenState, setItemSelectionState, setAllSelection } from '../state/slice';
import { BrowseDashboardsState, DashboardTreeSelection, SelectionState, BrowseDashboardsPermissions } from '../types';

import { DashboardsTree } from './DashboardsTree';
import { canSelectItems } from './utils';

interface BrowseViewProps {
  height: number;
  width: number;
  folderUID: string | undefined;
  permissions: BrowseDashboardsPermissions;
}

export function BrowseView({ folderUID, width, height, permissions }: BrowseViewProps) {
  const status = useBrowseLoadingStatus(folderUID);
  const dispatch = useDispatch();
  const flatTree = useFlatTreeState(folderUID);
  const selectedItems = useCheckboxSelectionState();
  const childrenByParentUID = useChildrenByParentUIDState();
  const canSelect = canSelectItems(permissions);
  const isProvisionedInstance = useIsProvisionedInstance();
  const provisioningEnabled = config.featureToggles.provisioning;
  const { data: settingsData } = useGetFrontendSettingsQuery(!provisioningEnabled ? skipToken : undefined);

  const excludeUIDs = useMemo(() => {
    if (isProvisionedInstance || !provisioningEnabled) {
      return [];
    }
    if (provisioningEnabled) {
      return settingsData?.items.map((repo) => repo.name);
    }

    return [];
  }, [isProvisionedInstance, settingsData, provisioningEnabled]);

  const handleFolderClick = useCallback(
    (clickedFolderUID: string, isOpen: boolean) => {
      dispatch(setFolderOpenState({ folderUID: clickedFolderUID, isOpen }));

      if (isOpen) {
        dispatch(fetchNextChildrenPage({ parentUID: clickedFolderUID, pageSize: PAGE_SIZE }));
      }
    },
    [dispatch]
  );

  const handleItemSelectionChange = useCallback(
    (item: DashboardViewItem, isSelected: boolean) => {
      dispatch(setItemSelectionState({ item, isSelected }));
    },
    [dispatch]
  );

  const isSelected = useCallback(
    (item: DashboardViewItem | '$all'): SelectionState => {
      if (item === '$all') {
        // We keep the boolean $all state up to date in redux, so we can short-circut
        // the logic if we know this has been selected
        if (selectedItems.$all) {
          return SelectionState.Selected;
        }

        // Otherwise, if we have any selected items, then it should be in 'mixed' state
        for (const selection of Object.values(selectedItems)) {
          if (typeof selection === 'boolean') {
            continue;
          }

          for (const uid in selection) {
            const isSelected = selection[uid];
            if (isSelected) {
              return SelectionState.Mixed;
            }
          }
        }

        // Otherwise otherwise, nothing is selected and header should be unselected
        return SelectionState.Unselected;
      }

      const isSelected = selectedItems[item.kind][item.uid];
      if (isSelected) {
        return SelectionState.Selected;
      }

      // Because if _all_ children, then the parent is selected (and bailed in the previous check),
      // this .some check will only return true if the children are partially selected
      const isMixed = hasSelectedDescendants(item, childrenByParentUID, selectedItems);
      if (isMixed) {
        return SelectionState.Mixed;
      }

      return SelectionState.Unselected;
    },
    [selectedItems, childrenByParentUID]
  );

  const isItemLoaded = useCallback(
    (itemIndex: number) => {
      const treeItem = flatTree[itemIndex];
      if (!treeItem) {
        return false;
      }
      const item = treeItem.item;
      const result = !(item.kind === 'ui' && item.uiKind === 'pagination-placeholder');

      return result;
    },
    [flatTree]
  );

  const handleLoadMore = useLoadNextChildrenPage();

  if (status === 'fulfilled' && flatTree.length === 0) {
    return (
      <div style={{ width }}>
        {canSelect ? (
          <EmptyState
            variant="call-to-action"
            button={
              <LinkButton
                href={folderUID ? `dashboard/new?folderUid=${folderUID}` : 'dashboard/new'}
                icon="plus"
                size="lg"
              >
                <Trans i18nKey="browse-dashboards.empty-state.button-title">Create dashboard</Trans>
              </LinkButton>
            }
            message={
              folderUID
                ? t('browse-dashboards.empty-state.title-folder', "This folder doesn't have any dashboards yet")
                : t('browse-dashboards.empty-state.title', "You haven't created any dashboards yet")
            }
          >
            {folderUID && (
              <Trans i18nKey="browse-dashboards.empty-state.pro-tip">
                Add/move dashboards to your folder at{' '}
                <TextLink external={false} href="/dashboards">
                  Browse dashboards
                </TextLink>
              </Trans>
            )}
          </EmptyState>
        ) : (
          <CallToActionCard
            callToActionElement={
              <span>
                <Trans i18nKey="browse-dashboards.browse-view.this-folder-is-empty">This folder is empty</Trans>
              </span>
            }
          />
        )}
      </div>
    );
  }

  return (
    <DashboardsTree
      permissions={permissions}
      items={flatTree}
      width={width}
      height={height}
      isSelected={isSelected}
      onFolderClick={handleFolderClick}
      onAllSelectionChange={(newState) => dispatch(setAllSelection({ isSelected: newState, folderUID, excludeUIDs }))}
      onItemSelectionChange={handleItemSelectionChange}
      isItemLoaded={isItemLoaded}
      requestLoadMore={handleLoadMore}
    />
  );
}

function hasSelectedDescendants(
  item: DashboardViewItem,
  childrenByParentUID: BrowseDashboardsState['childrenByParentUID'],
  selectedItems: DashboardTreeSelection
): boolean {
  const collection = childrenByParentUID[item.uid];
  if (!collection) {
    return false;
  }

  return collection.items.some((v) => {
    const thisIsSelected = selectedItems[v.kind][v.uid];
    if (thisIsSelected) {
      return thisIsSelected;
    }

    return hasSelectedDescendants(v, childrenByParentUID, selectedItems);
  });
}
