import { useCallback, useSyncExternalStore } from 'react';

import type { DashboardScene } from '../scene/DashboardScene';

const noop = () => {};

/**
 * Whether presses reach the dashboard in a Composer session on `dashboard`, as with the Assistant's Pointer tool: no
 * pick is pending, and neither a turn nor a capture holds the overlay. False without a session.
 */
export function useComposerPointerMode(dashboard: DashboardScene): boolean {
  // Not subscribed to the scene: callers already re-render on mode changes, which is when a session starts or ends.
  const session = dashboard.getComposerSession();
  const subscribe = useCallback((listener: () => void) => session?.subscribe(listener) ?? noop, [session]);
  return useSyncExternalStore(subscribe, () => {
    if (!session) {
      return false;
    }
    const { picking, paused, capturing } = session.getOverlayState();
    return !picking && !paused && !capturing;
  });
}
