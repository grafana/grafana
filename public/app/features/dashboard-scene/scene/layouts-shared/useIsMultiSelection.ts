import { useContext } from 'react';

import { ElementSelectionContext } from '@grafana/ui';

/**
 * Whether more than one element is currently selected on the dashboard canvas.
 * Canvas controls (add panel, group into row/tab, etc.) are hidden while a
 * multi-selection is active since they don't act on the selection.
 */
export function useIsMultiSelection(): boolean {
  const context = useContext(ElementSelectionContext);
  return (context?.selected.length ?? 0) > 1;
}

/**
 * Number of selected elements when the given element is part of a multi-selection, 0 otherwise.
 */
export function useMultiSelectionCountFor(id: string | undefined): number {
  const context = useContext(ElementSelectionContext);
  const selected = context?.selected ?? [];

  if (!id || selected.length < 2 || !selected.some((item) => item.id === id)) {
    return 0;
  }

  return selected.length;
}
