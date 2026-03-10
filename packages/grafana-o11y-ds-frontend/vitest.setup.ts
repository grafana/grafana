import { vi } from 'vitest';
import failOnConsole from 'vitest-fail-on-console';

import '@testing-library/jest-dom/vitest';

// Mock @react-awesome-query-builder/ui — its ESM build has extensionless imports
// that Node's native ESM loader can't resolve. This package is a transitive
// dependency (via @grafana/plugin-ui) and not used by any tests in this package.
vi.mock('@grafana/plugin-ui', () => ({
  ConfigDescriptionLink: vi.fn(),
  ConfigSection: vi.fn(),
}));

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
