// `structuredClone` is not yet in jsdom https://github.com/jsdom/jsdom/issues/3363
import 'core-js/stable/structured-clone';
import 'whatwg-fetch';
import '@testing-library/jest-dom';

import { configure } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { vi } from 'vitest';
import failOnConsole from 'vitest-fail-on-console';

import { matchers } from '@grafana/test-utils';

import getEnvConfig from '../../scripts/webpack/env-util';

const config = getEnvConfig() as Record<string, string | boolean>;

if (config.frontend_dev_fail_tests_on_console || process.env.CI) {
  failOnConsole({
    shouldFailOnLog: true,
    shouldFailOnDebug: true,
    shouldFailOnInfo: true,
  });
}

expect.extend(matchers);

i18next.use(initReactI18next).init({
  resources: {},
  returnEmptyString: false,
  lng: 'en-US', // this should be the locale of the phrases in our source JSX
});

// mock out the worker that detects changes in the dashboard
// The mock is needed because JSDOM does not support workers and
// the factory uses import.meta.url so we can't use it in CommonJS modules.
vi.mock('app/features/dashboard-scene/saving/createDetectChangesWorker.ts');

// Mock useLoadAppPlugins to prevent async state updates in tests
vi.mock('app/features/plugins/extensions/useLoadAppPlugins', () => ({
  useLoadAppPlugins: vi.fn().mockReturnValue({ isLoading: false }),
}));

// Mock usePluginComponents to return empty components for all tests by default
// Tests that need to test plugin components can override this mock
vi.mock('app/features/plugins/extensions/usePluginComponents', async (importOriginal) => ({
  ...(await importOriginal()),
  usePluginComponents: vi.fn().mockReturnValue({ components: [], isLoading: false }),
}));

// our tests are heavy in CI due to parallelisation and monaco and kusto
// so we increase the default timeout to 2secs to avoid flakiness
configure({ asyncUtilTimeout: 2000 });

// Mock Performance API methods not implemented in jsdom
if (window.performance) {
  // Type-safe spies with proper return type definitions
  if (!window.performance.mark) {
    window.performance.mark = vi.mocked<typeof window.performance.mark>((markName: string) => {
      return {
        name: markName,
        entryType: 'mark',
        startTime: 0,
        duration: 0,
        detail: null,
        toJSON: () => ({}),
      };
    });
  }

  if (!window.performance.measure) {
    window.performance.measure = vi.mocked<typeof window.performance.measure>((measureName: string) => {
      return {
        name: measureName,
        entryType: 'measure',
        startTime: 0,
        duration: 100,
        detail: null,
        toJSON: () => ({}),
      };
    });
  }

  if (!window.performance.getEntriesByName) {
    window.performance.getEntriesByName = vi.mocked<typeof window.performance.getEntriesByName>(() => []);
  }

  if (!window.performance.clearMarks) {
    window.performance.clearMarks = vi.mocked<typeof window.performance.clearMarks>(() => {});
  }

  if (!window.performance.clearMeasures) {
    window.performance.clearMeasures = vi.mocked<typeof window.performance.clearMeasures>(() => {});
  }
}
