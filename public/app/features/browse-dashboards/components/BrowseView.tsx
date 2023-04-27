import React, { useCallback, useEffect } from 'react';

import { DashboardViewItem } from 'app/features/search/types';
import { useDispatch } from 'app/types';

import {
  useFlatTreeState,
  useCheckboxSelectionState,
  fetchChildren,
  setFolderOpenState,
  setItemSelectionState,
  useChildrenByParentUIDState,
  setAllSelection,
} from '../state';
import { DashboardTreeSelection, SelectionState } from '../types';

import { DashboardsTree } from './DashboardsTree';

interface BrowseViewProps {
  height: number;
  width: number;
  folderUID: string | undefined;
  canSelect: boolean;
}

export function BrowseView({ folderUID, width, height, canSelect }: BrowseViewProps) {
  const dispatch = useDispatch();
  const flatTree = useFlatTreeState(folderUID);
  const selectedItems = useCheckboxSelectionState();
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

    handleFolderClick('c056cc75-9162-426f-80af-fd7722172e60', true);
    handleFolderClick('fd51d699-bd35-4e6b-83de-235aa1946fe7', true);
    handleFolderClick('dfe4a6d2-b608-48a3-aa49-3ecd0de7553b', true);
    handleFolderClick('c6a3b0e9-7bad-4c5c-9026-e079cbb79888', true);
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
        return selectedItems.$all ? SelectionState.Selected : SelectionState.Unselected;
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
    />
  );
}

function hasSelectedDescendants(
  item: DashboardViewItem,
  childrenByParentUID: Record<string, DashboardViewItem[] | undefined>,
  selectedItems: DashboardTreeSelection
): boolean {
  const children = childrenByParentUID[item.uid];
  if (!children) {
    return false;
  }

  return children.some((v) => {
    const thisIsSelected = selectedItems[v.kind][v.uid];
    if (thisIsSelected) {
      return thisIsSelected;
    }

    return hasSelectedDescendants(v, childrenByParentUID, selectedItems);
  });
}
