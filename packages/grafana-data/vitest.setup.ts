import { vi } from 'vitest';
import failOnConsole from 'vitest-fail-on-console';

import { matchers } from '@grafana/test-utils';

import getEnvConfig from '../../scripts/webpack/env-util';

import { patchArrayVectorProrotypeMethods } from './src/types/vector';

if (getEnvConfig().frontend_dev_fail_tests_on_console || process.env.CI) {
  failOnConsole({ shouldFailOnLog: true, shouldFailOnDebug: true, shouldFailOnInfo: true });
}

expect.extend(matchers);

patchArrayVectorProrotypeMethods();

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

// mock the intersection observer and just say everything is in view
const mockIntersectionObserver = vi.fn().mockImplementation(function (
  callback: (arg: IntersectionObserverEntry[]) => void
) {
  return {
    observe: vi.fn().mockImplementation((elem: HTMLElement) => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      callback([{ target: elem, isIntersecting: true }] as unknown as IntersectionObserverEntry[]);
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
});
global.IntersectionObserver = mockIntersectionObserver;
