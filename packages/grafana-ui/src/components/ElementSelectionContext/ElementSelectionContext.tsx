import React, { createContext, useCallback, useContext } from 'react';

export interface ElementSelectionOnSelectOptions {
  /** If specified, this will ignore the shift key press */
  multi?: boolean;

  /** If true, this will make sure the element is selected */
  force?: boolean;
}

/** @alpha */
export interface ElementSelectionContextState {
  /**
   * Turn on selection mode & show selection state
   */
  enabled?: boolean;
  /** List of currently selected elements */
  selected: ElementSelectionContextItem[];
  onSelect: (item: ElementSelectionContextItem, options: ElementSelectionOnSelectOptions) => void;
  onClear: () => void;
}

export interface ElementSelectionContextItem {
  id: string;
}

export const ElementSelectionContext = createContext<ElementSelectionContextState | undefined>(undefined);

export interface UseElementSelectionResult {
  isSelected?: boolean;
  isSelectable?: boolean;
  onSelect?: (evt: React.PointerEvent, options?: ElementSelectionOnSelectOptions) => void;
  onClear?: () => void;
}

export function useElementSelection(id: string | undefined): UseElementSelectionResult {
  if (!id) {
    return {};
  }

  const context = useContext(ElementSelectionContext);
  if (!context) {
    return {};
  }

  const isSelected = context.selected.some((item) => item.id === id);
  const onSelect = useCallback(
    (evt: React.PointerEvent, options: ElementSelectionOnSelectOptions = {}) => {
      if (!context.enabled) {
        return;
      }

      // To prevent this click form clearing the selection
      evt.stopPropagation();

      // Prevent text selection caused by shift click
      if (evt.shiftKey) {
        evt.preventDefault();
        window.getSelection()?.empty();
      }

      context.onSelect({ id }, { ...options, multi: options.multi ?? evt.shiftKey });
    },
    [context, id]
  );

  const onClear = useCallback(() => {
    if (!context.enabled) {
      return;
    }

    context.onClear();
  }, [context]);

  return { isSelected, onSelect, onClear, isSelectable: context.enabled };
}
