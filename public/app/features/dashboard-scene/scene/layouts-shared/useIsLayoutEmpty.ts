import { useEffect, useState } from 'react';

import { SceneObjectStateChangedEvent } from '@grafana/scenes';

import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';

/**
 * Whether the layout currently contains no panels. Scene state change events
 * bubble up the graph, so subscribing on the layout manager also reacts to
 * panels being added or removed anywhere in its subtree.
 */
export function useIsLayoutEmpty(layout: DashboardLayoutManager): boolean {
  const [isEmpty, setIsEmpty] = useState(() => layout.getVizPanels().length === 0);

  useEffect(() => {
    setIsEmpty(layout.getVizPanels().length === 0);

    const sub = layout.subscribeToEvent(SceneObjectStateChangedEvent, () => {
      setIsEmpty(layout.getVizPanels().length === 0);
    });

    return () => sub.unsubscribe();
  }, [layout]);

  return isEmpty;
}
