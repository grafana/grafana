export * from './common/constants';
export * from './common/images';
// export * from './common/install';
export * from './common/launcher';
export * from './common/login';
export * from './common/pageObjects';
export * from './common/pageInfo';
export * from './common/scenario';
export * from './common/puppeteer';

import * as pages from './common/pages';
import * as plugins from './plugins';

export { pages, plugins };

// Path to install scripts, available for @grafana/toolkit so that it does not need to resolve the path relatively to node_modules
export const GRAFANA_E2E_INSTALL_SCRIPT_PATH = `${__dirname}/common/install`;
