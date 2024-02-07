// import { Dashboard } from '@grafana/schema';

import { getSaveDashboardChange } from './test';
self.onmessage = (e: MessageEvent<{ initial: any; changed: any }>) => {
  const result = getSaveDashboardChange(e.data.initial, e.data.changed);

  self.postMessage(result);
};

export {};
