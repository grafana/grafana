import { useCallback, useEffect, useState } from 'react';

// Uses enum to enable extension in the future
export enum KeyboardAction {
  SELECT = 'select',
  EXPAND = 'expand',
}

// Handles keyboard interactions for the scopes tree
// optionCount is the number of options in the tree
// onSelect is the function to call when an option is selected
// Returns the highlighted index
export function useKeyboardInteraction(optionCount: number, onSelect: (index: number, action: KeyboardAction) => void) {
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      // If there are no options, do nothing. Also to prevent dividing by 0
      if (optionCount === 0) {
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          setHighlightedIndex((prev) => (prev + 1) % optionCount);
          break;
        case 'ArrowUp':
          setHighlightedIndex((prev) => (prev - 1 + optionCount) % optionCount);
          break;
        case 'Enter':
          if (highlightedIndex !== -1) {
            onSelect(highlightedIndex, KeyboardAction.SELECT);
          }
          break;
        case 'ArrowRight':
          if (highlightedIndex !== -1) {
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
    [optionCount, onSelect, highlightedIndex]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Reset highlighted index when optionCount changes to 0
  useEffect(() => {
    if (optionCount === 0) {
      setHighlightedIndex(-1);
    }
  }, [optionCount]);

  return { highlightedIndex };
}
