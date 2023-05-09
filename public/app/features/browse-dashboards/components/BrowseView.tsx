import { debounce, throttle } from 'lodash';
import React, { useCallback, useEffect, useMemo } from 'react';
import { ListOnItemsRenderedProps } from 'react-window';

import { Spinner } from '@grafana/ui';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { DashboardViewItem } from 'app/features/search/types';
import { useDispatch, useSelector } from 'app/types';

import {
  useFlatTreeState,
  useCheckboxSelectionState,
  fetchChildren,
  setFolderOpenState,
  setItemSelectionState,
  useChildrenByParentUIDState,
  setAllSelection,
  useBrowseLoadingStatus,
} from '../state';
import { BrowseDashboardsState, DashboardTreeSelection, SelectionState } from '../types';

import { DashboardsTree } from './DashboardsTree';

interface BrowseViewProps {
  height: number;
  width: number;
  folderUID: string | undefined;
  canSelect: boolean;
}

export function BrowseView({ folderUID, width, height, canSelect }: BrowseViewProps) {
  const status = useBrowseLoadingStatus(folderUID);
  const dispatch = useDispatch();
  const flatTree = useFlatTreeState(folderUID);
  const selectedItems = useCheckboxSelectionState();
  const rootItems = useSelector((wholeState) => wholeState.browseDashboards.rootItems);
  const childrenByParentUID = useChildrenByParentUIDState();

  const handleFolderClick = useCallback(
    (clickedFolderUID: string, isOpen: boolean) => {
      dispatch(setFolderOpenState({ folderUID: clickedFolderUID, isOpen }));

      if (isOpen) {
        dispatch(fetchChildren(clickedFolderUID));
      }
    },
    [dispatch]
  );

  useEffect(() => {
    dispatch(fetchChildren(folderUID));
  }, [handleFolderClick, dispatch, folderUID]);

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

  const handleItemsRendered = useMemo(() => {
    function fn(props: ListOnItemsRenderedProps) {
      console.group(
        'Visible range: %c%d%c - %c%d%c. Overscan range: %c%d%c - %c%d%c. flatTree last index %c%d%c',
        'color: #3498db',
        props.visibleStartIndex,
        'color: unset',
        'color: #3498db',
        props.visibleStopIndex,
        'color: unset',
        'color: #3498db',
        props.overscanStartIndex,
        'color: unset',
        'color: #3498db',
        props.overscanStopIndex,
        'color: unset',
        'color: #3498db',
        flatTree.length - 1,
        'color: unset'
      );

      // Continue if overscan range >= flatTree.length - 1

      // TODO: instead of checking length of flatTree, we've got to check the length of....
      // the expanded folder that's intersecting with overscanStopIndex? what if our page sizes
      // are smaller than what's visible on screen?
      const maybeShouldLoadMore = props.overscanStopIndex >= flatTree.length - 1;

      if (!maybeShouldLoadMore) {
        console.log('Already loaded enough for now');
        console.groupEnd();
        return;
      }

      let folderToLoad: DashboardViewItem | undefined;

      for (let index = 0; index < props.overscanStopIndex; index++) {
        const viewItem = flatTree[index];
        const { isOpen, item } = viewItem;

        if (item.kind !== 'folder' || !isOpen) {
          continue;
        }

        const collection = childrenByParentUID[item.uid];
        if (!collection) {
          // should never happen
          continue;
        }

        const isFullyLoaded = collection.lastFetched === 'dashboard' && collection.lastFetchedSize < 50;
        if (isFullyLoaded) {
          continue;
        }

        console.log(item, 'is first open folder to load');
        folderToLoad = item;
        break;
      }

      if (folderToLoad) {
        console.log('load more children from', folderToLoad);
        dispatch(fetchChildren(folderToLoad.uid));
      } else {
        console.log('see if we need to load more root items');

        const rootCollection = folderUID ? childrenByParentUID[folderUID] : rootItems;
        if (!rootCollection) {
          console.groupEnd();
          return;
        }
        const isFullyLoaded = rootCollection.lastFetched === 'dashboard' && rootCollection.lastFetchedSize < 50;
        if (!isFullyLoaded) {
          dispatch(fetchChildren(folderUID));
        }

        console.groupEnd();
      }
    }

    // TODO: doesnt work if opening a folder at the top after we've scrolled a lot
    // TODO: should not attempt to load additional children if a request is already in flight

    return throttle(fn, 300);
  }, [flatTree, dispatch, folderUID, rootItems, childrenByParentUID]);

  if (status === 'pending') {
    return <Spinner />;
  }

  if (status === 'fulfilled' && flatTree.length === 0) {
    return (
      <div style={{ width }}>
        <EmptyListCTA
          title={folderUID ? "This folder doesn't have any dashboards yet" : 'No dashboards yet. Create your first!'}
          buttonIcon="plus"
          buttonTitle="Create Dashboard"
          buttonLink={folderUID ? `dashboard/new?folderUid=${folderUID}` : 'dashboard/new'}
          proTip={folderUID && 'Add/move dashboards to your folder at ->'}
          proTipLink={folderUID && 'dashboards'}
          proTipLinkTitle={folderUID && 'Browse dashboards'}
          proTipTarget=""
        />
      </div>
    );
  }

  return (
    <DashboardsTree
      canSelect={canSelect}
      items={flatTree}
      width={width}
      height={height}
      isSelected={isSelected}
      onFolderClick={handleFolderClick}
      onAllSelectionChange={(newState) => dispatch(setAllSelection({ isSelected: newState }))}
      onItemSelectionChange={handleItemSelectionChange}
      onItemsRendered={handleItemsRendered}
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
