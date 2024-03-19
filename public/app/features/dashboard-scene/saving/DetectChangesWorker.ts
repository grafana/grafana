// Worker is not three shakable, so we should not import the whole loadash library
// eslint-disable-next-line lodash/import-scope
import debounce from 'lodash/debounce';

import { getDashboardChanges } from './getDashboardChanges';

self.onmessage = debounce((e: MessageEvent<{ initial: any; changed: any }>) => {
  const result = getDashboardChanges(e.data.initial, e.data.changed, false, false);
  self.postMessage(result);
}, 500);
