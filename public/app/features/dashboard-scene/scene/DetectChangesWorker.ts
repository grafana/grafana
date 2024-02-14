import { debounce } from 'lodash';

import { getDashboardChanges } from './getDashboardChanges';

self.onmessage = debounce((e: MessageEvent<{ initial: any; changed: any }>) => {
  const result = getDashboardChanges(e.data.initial, e.data.changed, true, true);
  self.postMessage(result);
}, 500);

export {};
