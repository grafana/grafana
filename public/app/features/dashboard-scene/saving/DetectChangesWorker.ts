import { Dashboard } from '@grafana/schema';

import { getRawDashboardChanges } from './getDashboardChanges';

function _debounce<T>(f: (...args: T[]) => void, timeout: number) {
  let timeoutId: NodeJS.Timeout | undefined = undefined;
  return (...theArgs: T[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      f(...theArgs);
    }, timeout);
  };
}

self.onmessage = _debounce((e: MessageEvent<{ initial: Dashboard; changed: Dashboard }>) => {
  const result = getRawDashboardChanges(e.data.initial, e.data.changed, false, false, false);
  self.postMessage(result);
}, 500);
