import { useCallback, useEffect, useState } from 'react';
import type * as React from 'react';

import { type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { type DashboardViewItem } from 'app/features/search/types';

import { getDOMId } from './NestedFolderList';

interface TreeInteractionProps {
  tree: DashboardsTreeItem[];
  handleCloseOverlay: () => void;
  handleFolderSelect: (item: DashboardViewItem) => void;
  handleFolderExpand: (uid: string, newOpenState: boolean) => Promise<void>;
  idPrefix: string;
  search: string;
  visible: boolean;
}

export function useTreeInteractions({
  tree,
  handleCloseOverlay,
  handleFolderSelect,
  handleFolderExpand,
  idPrefix,
  search,
  visible,
}: TreeInteractionProps) {
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);
  const [prevVisible, setPrevVisible] = useState(visible);
  const [prevSearch, setPrevSearch] = useState(search);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) {
      setFocusedItemIndex(-1);
    }
  }
  if (prevSearch !== search) {
    setPrevSearch(search);
    setFocusedItemIndex(0);
  }

  useEffect(() => {
    document
      .getElementById(getDOMId(idPrefix, tree[focusedItemIndex]?.item.uid))
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [focusedItemIndex, idPrefix, tree]);

  const handleKeyDown = useCallback(
    (ev: React.KeyboardEvent<HTMLInputElement>) => {
      const foldersAreOpenable = !search;
      switch (ev.key) {
        // Expand/collapse folder on right/left arrow keys
        case 'ArrowRight':
        case 'ArrowLeft':
          if (foldersAreOpenable) {
            ev.preventDefault();
            handleFolderExpand(tree[focusedItemIndex].item.uid, ev.key === 'ArrowRight');
          }
          break;
        case 'ArrowUp':
          if (focusedItemIndex > 0) {
            ev.preventDefault();
            setFocusedItemIndex(focusedItemIndex - 1);
          }
          break;
        case 'ArrowDown':
          if (focusedItemIndex < tree.length - 1) {
            ev.preventDefault();
            setFocusedItemIndex(focusedItemIndex + 1);
          }
          break;
        case 'Enter':
          ev.preventDefault();
          const { item, disabled } = tree[focusedItemIndex];
          if (item.kind === 'folder' && !disabled) {
            handleFolderSelect(item);
          }
          break;
        case 'Tab':
          ev.stopPropagation();
          handleCloseOverlay();
          break;
        case 'Escape':
          ev.stopPropagation();
          ev.preventDefault();
          handleCloseOverlay();
          break;
      }
    },
    [focusedItemIndex, handleCloseOverlay, handleFolderExpand, handleFolderSelect, search, tree]
  );

  return {
    focusedItemIndex,
    handleKeyDown,
  };
}
