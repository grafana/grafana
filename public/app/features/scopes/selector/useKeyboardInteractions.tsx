import { useCallback, useEffect, useState } from 'react';

export function useKeyboardInteraction(optionCount: number, onSelect: (index: number) => void) {
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): void => {
      switch (event.key) {
        case 'ArrowDown':
          setHighlightedIndex((prev) => (prev + 1) % optionCount);
          break;
        case 'ArrowUp':
          setHighlightedIndex((prev) => (prev - 1 + optionCount) % optionCount);
          break;
        case 'Enter':
          if (highlightedIndex !== -1) {
            onSelect(highlightedIndex);
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
