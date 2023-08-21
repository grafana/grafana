import * as comlink from 'comlink';

import { routeGroupsMatcher } from './routeGroupsMatcher';

// Worker is only a thin wrapper around routeGroupsMatcher to move processing to a separate thread
// routeGroupsMatcher should be used in mocks and tests because it's difficult to tests code with workers
comlink.expose(routeGroupsMatcher);
