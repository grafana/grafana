import React, { useCallback, useEffect } from 'react';

import { DashboardViewItem } from 'app/features/search/types';
import { useDispatch } from 'app/types';

import {
  useFlatTreeState,
  useSelectedItemsState,
  fetchChildren,
  setFolderOpenState,
  setItemSelectionState,
} from '../state';

import { DashboardsTree } from './DashboardsTree';

interface BrowseViewProps {
  height: number;
  width: number;
  folderUID: string | undefined;
}

export function BrowseView({ folderUID, width, height }: BrowseViewProps) {
  const dispatch = useDispatch();
  const flatTree = useFlatTreeState(folderUID);
  const selectedItems = useSelectedItemsState();

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

  return (
    <DashboardsTree
      items={flatTree}
      width={width}
      height={height}
      selectedItems={selectedItems}
      onFolderClick={handleFolderClick}
      onItemSelectionChange={handleItemSelectionChange}
    />
  );
}
