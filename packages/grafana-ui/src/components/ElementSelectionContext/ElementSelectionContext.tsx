import React, { createContext, useCallback, useContext } from 'react';

/** @alpha */
export interface ElementSelectionContextState {
  /**
   * Turn on selection mode & show selection state
   */
  enabled?: boolean;
  /** List of currently selected elements */
  selected: ElementSelectionContextItem[];
  onSelect: (item: ElementSelectionContextItem, multi?: boolean) => void;
}

export interface ElementSelectionContextItem {
  id: string;
}

export const ElementSelectionContext = createContext<ElementSelectionContextState | undefined>(undefined);

export interface UseElementSelectionResult {
  isSelected?: boolean;
  isSelectable?: boolean;
  onSelect?: (evt: React.PointerEvent) => void;
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
  const onSelect = useCallback<React.PointerEventHandler>(
    (evt) => {
      if (!context.enabled) {
        return;
      }

      // To prevent this click form clearing the selection
      evt.stopPropagation();

      context.onSelect({ id }, evt.shiftKey);
    },
    [context, id]
  );

  return { isSelected, onSelect, isSelectable: context.enabled };
}
