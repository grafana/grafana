import failOnConsole from 'vitest-fail-on-console';

import getEnvConfig from '../../scripts/webpack/env-util';

import { matchers } from './src/matchers/index';

if (getEnvConfig().frontend_dev_fail_tests_on_console || process.env.CI) {
  failOnConsole({ shouldFailOnLog: true, shouldFailOnDebug: true, shouldFailOnInfo: true });
}

expect.extend(matchers);
