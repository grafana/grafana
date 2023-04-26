import React, { useCallback, useEffect } from 'react';

import { DashboardViewItem, DashboardViewItemKind } from 'app/features/search/types';
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
import { SelectionState } from '../types';

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

  useEffect(() => {
    dispatch(fetchChildren(folderUID));
  }, [dispatch, folderUID]);

  const handleFolderClick = useCallback(
    (clickedFolderUID: string, isOpen: boolean) => {
      dispatch(setFolderOpenState({ folderUID: clickedFolderUID, isOpen }));

      if (isOpen) {
        dispatch(fetchChildren(clickedFolderUID));
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
    (kind: DashboardViewItemKind | '$all', uid: string): SelectionState => {
      if (kind === '$all') {
        return selectedItems.$all ? SelectionState.Selected : SelectionState.Unselected;
      }

      const isSelected = selectedItems[kind][uid];
      if (isSelected) {
        return SelectionState.Selected;
      }

      // Because if _all_ children, then the parent is selected (and bailed in the previous check),
      // this .some check will only return true if the children are partially selected
      const isMixed = (childrenByParentUID[uid] ?? []).some((v) => selectedItems[v.kind][v.uid]);
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
