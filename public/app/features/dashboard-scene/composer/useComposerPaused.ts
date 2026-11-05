import { useCallback, useSyncExternalStore } from 'react';

import type { DashboardScene } from '../scene/DashboardScene';

const noop = () => {};

/** Whether a Composer session on `dashboard` is paused, which the plugin does for the length of a turn. */
export function useComposerPaused(dashboard: DashboardScene): boolean {
  // Not subscribed to the scene: callers already re-render on mode changes, and a session that ends
  // notifies its listeners with `paused: false`.
  const session = dashboard.getComposerSession();
  const subscribe = useCallback((listener: () => void) => session?.subscribe(listener) ?? noop, [session]);
  return useSyncExternalStore(subscribe, () => session?.getOverlayState().paused ?? false);
}
