import { useCallback, useEffect, useState } from 'react';

import { TreeNode } from './types';

// Uses enum to enable extension in the future
export enum KeyboardAction {
  SELECT = 'select',
  EXPAND = 'expand',
}

// Handles keyboard interactions for the scopes tree
// onSelect is the function to call when an option is selected
// Returns the highlighted index
export function useKeyboardInteraction(
  enabled: boolean,
  items: TreeNode[],
  searchQuery: string,
  onSelect: (index: number, action: KeyboardAction) => void
) {
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      if (!enabled) {
        return;
      }

      // If there are no options, do nothing. Also to prevent dividing by 0
      if (items.length === 0) {
        return;
      }

      switch (event.key) {
        // Change highlighted index
        case 'ArrowDown':
          event.preventDefault();

          setHighlightedIndex((prev) => (prev + 1) % items.length);
          break;
        case 'ArrowUp':
          event.preventDefault();

          setHighlightedIndex((prev) => (prev - 1 + items.length) % items.length);
          break;
        // Handle Select action
        case 'Enter':
          event.preventDefault();

          if (highlightedIndex !== -1) {
            onSelect(highlightedIndex, KeyboardAction.SELECT);
          }
          break;
        // Handle Expand action
        case 'ArrowRight':
          // Let checking if an item actually is expandable be handled in onSelect
          if (highlightedIndex !== -1) {
            // Send an expand action here and let onSelect determine if the node actually is expandable
            event.preventDefault();
            onSelect(highlightedIndex, KeyboardAction.EXPAND);
          }

          break;
        case 'Escape':
          setHighlightedIndex(-1);
          break;
        default:
          break;
      }
    },
    [items, onSelect, highlightedIndex, enabled]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Reset highlighted index when items length changes to 0
  useEffect(() => {
    if (items.length === 0) {
      setHighlightedIndex(-1);
    }
  }, [items]);

  useEffect(() => {
    // Reset when doing a new query
    setHighlightedIndex(-1);
  }, [searchQuery, enabled]);

  return { highlightedIndex };
}
