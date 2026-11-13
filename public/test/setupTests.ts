// `structuredClone` is not yet in jsdom https://github.com/jsdom/jsdom/issues/3363
import 'core-js/stable/structured-clone';
import 'whatwg-fetch';
import i18next from 'i18next';
import failOnConsole from 'jest-fail-on-console';

import { initReactI18next } from 'react-i18next/initReactI18next';

import { matchers } from '@grafana/test-utils';

import { setPluginComponentsHook } from '../../packages/grafana-runtime/src/services/pluginExtensions/usePluginComponents';

import { jestDomMatchers } from './lazyJestDomMatchers';

// The config leaf shares state with the public entry without loading its query/render graph.
const { configure } = require('@testing-library/dom/dist/config') as Pick<
  typeof import('@testing-library/dom'),
  'configure'
>;
configure({ asyncUtilTimeout: 2000 });

// Unmount before console enforcement restores its spies, without importing React in pure suites.
const reactTestingLibrary = require.resolve('@testing-library/react');
const pureReactTestingLibrary = require.resolve('@testing-library/react/pure');
const reactCleanups = new Set<typeof import('@testing-library/react').cleanup>();
function rememberReactCleanup() {
  for (const entry of [reactTestingLibrary, pureReactTestingLibrary]) {
    const loaded = require.cache[entry];
    if (loaded) {
      reactCleanups.add(loaded.exports.cleanup);
    }
  }
}
// Nested teardown can reset modules before this setup's afterEach. Keep cleanup for retained imports.
beforeEach(rememberReactCleanup);
afterEach(() => {
  rememberReactCleanup();
  for (const cleanup of reactCleanups) {
    cleanup();
  }
});

declare const __GRAFANA_TEST_FAIL_ON_CONSOLE__: boolean;

// Configurations that replace Jest's globals still need the existing developer preference.
const failTestsOnConsole =
  process.env.CI ||
  (typeof __GRAFANA_TEST_FAIL_ON_CONSOLE__ !== 'undefined'
    ? __GRAFANA_TEST_FAIL_ON_CONSOLE__
    : (require('../../scripts/cli/env-util.cjs') as typeof import('../../scripts/cli/env-util')).getEnvConfig(
        `${__dirname}/../..`
      ).frontend_dev_fail_tests_on_console);

if (failTestsOnConsole) {
  failOnConsole({
    shouldFailOnLog: true,
    shouldFailOnDebug: true,
    shouldFailOnInfo: true,
    // Print the message for debug. Still fails the tests.
    shouldPrintMessage: true,
  });
}

expect.extend(jestDomMatchers);
expect.extend(matchers);

i18next.use(initReactI18next).init({
  resources: {},
  returnEmptyString: false,
  lng: 'en-US', // this should be the locale of the phrases in our source JSX
});

// FingerprintJS randomly sends installation telemetry during load, independently of backend requests.
// Keep real fingerprint generation, but do not send third-party telemetry from tests.
jest.mock('@fingerprintjs/fingerprintjs', () => {
  const actual = jest.requireActual<typeof import('@fingerprintjs/fingerprintjs')>('@fingerprintjs/fingerprintjs');
  const load: typeof actual.load = (options) => actual.load({ ...options, monitoring: false });
  return { ...actual, __esModule: true, load, default: { ...actual.default, load } };
});

// Pre-resolve dashboard API version resolver with beta defaults so tests
// don't trigger real network requests via getDashboardAPI() -> resolve().
// Tests that need to test the resolver itself should call reset() in beforeEach.
jest.mock('app/features/dashboard/api/DashboardAPIVersionResolver', () => {
  const actual = jest.requireActual('app/features/dashboard/api/DashboardAPIVersionResolver');
  actual.dashboardAPIVersionResolver.set({ v1: 'v1beta1', v2: 'v2beta1' });
  return actual;
});

// Pre-resolve folder app API to v1beta1 so tests using MSW folder handlers (v1beta1 paths) do not hit discovery.
jest.mock('@grafana/api-clients/rtkq/folder/v1beta1', () => {
  const actual = jest.requireActual('@grafana/api-clients/rtkq/folder/v1beta1');
  actual.folderAPIVersionResolver.set('v1beta1');
  return actual;
});

// mock out the worker that detects changes in the dashboard
// The mock is needed because JSDOM does not support workers and
// the factory uses import.meta.url so we can't use it in CommonJS modules.
jest.mock('app/features/dashboard-scene/saving/createDetectChangesWorker.ts');

// Mock useLoadAppPlugins to prevent async state updates in tests
jest.mock('app/features/plugins/extensions/useLoadAppPlugins', () => ({
  useLoadAppPlugins: jest.fn().mockReturnValue({ isLoading: false }),
}));

// Mock usePluginComponents to return empty components for all tests by default
// Tests that need to test plugin components can override this mock
jest.mock('app/features/plugins/extensions/usePluginComponents', () => ({
  ...jest.requireActual('app/features/plugins/extensions/usePluginComponents'),
  usePluginComponents: jest.fn().mockReturnValue({ components: [], isLoading: false }),
}));

// Runtime consumers also need a default hook because tests do not run Grafana's startup registration.
// Register once per suite so tests can override it with setPluginComponentsHook.
setPluginComponentsHook(() => ({ components: [], isLoading: false }));

// Mock Performance API methods not implemented in jsdom
if (window.performance) {
  // Type-safe spies with proper return type definitions
  if (!window.performance.mark) {
    window.performance.mark = jest.mocked<typeof window.performance.mark>((markName: string) => {
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
    window.performance.measure = jest.mocked<typeof window.performance.measure>((measureName: string) => {
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
    window.performance.getEntriesByName = jest.mocked<typeof window.performance.getEntriesByName>(() => []);
  }

  if (!window.performance.clearMarks) {
    window.performance.clearMarks = jest.mocked<typeof window.performance.clearMarks>(() => {});
  }

  if (!window.performance.clearMeasures) {
    window.performance.clearMeasures = jest.mocked<typeof window.performance.clearMeasures>(() => {});
  }
}

// jsdom does not implement Range client-rect measurement, which CodeMirror uses
// to position its cursor and tooltips. Provide inert stubs so editors render in
// tests without each test having to mock them.
if (typeof Range !== 'undefined') {
  const emptyRect: DOMRect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
  };

  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => {
      const list = { length: 0, item: () => null, [Symbol.iterator]: function* () {} };
      return list as unknown as DOMRectList;
    };
  }

  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => emptyRect;
  }
}
