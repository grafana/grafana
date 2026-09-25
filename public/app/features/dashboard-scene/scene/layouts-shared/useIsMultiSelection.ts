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
