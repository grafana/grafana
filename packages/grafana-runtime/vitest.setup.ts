import { vi } from 'vitest';
import failOnConsole from 'vitest-fail-on-console';
import '@testing-library/jest-dom/vitest';

import getEnvConfig from '../../scripts/webpack/env-util';

if (getEnvConfig().frontend_dev_fail_tests_on_console || process.env.CI) {
  failOnConsole({ shouldFailOnLog: true, shouldFailOnDebug: true, shouldFailOnInfo: true });
}

window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(), // Deprecated
  removeListener: vi.fn(), // Deprecated
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});
