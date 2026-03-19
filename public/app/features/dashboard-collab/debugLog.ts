/**
 * Debug logging utility for dashboard collaboration.
 *
 * Toggle via browser console:
 *   localStorage.setItem('grafana.debug.dashboardCollab', 'true')
 *   localStorage.setItem('grafana.debug.dashboardCollab', 'false')
 */

import { store } from '@grafana/data';

export function createDebugLog(key: string, prefix: string) {
  const storageKey = `grafana.debug.${key}`;

  return function debugLog(message: string, ...args: unknown[]) {
    if (store.get(storageKey) === 'true') {
      console.log(`[${prefix}] ${message}`, ...args);
    }
  };
}

export const debugLog = createDebugLog('dashboardCollab', 'Dashboard Collab');
