// This import has side effects, and must be at the top so jQuery is made global first
import '../../public/test/global-jquery-shim';

import { configure } from '@testing-library/react';
import { vi } from 'vitest';
import failOnConsole from 'vitest-fail-on-console';
import '@testing-library/jest-dom/vitest';

import getEnvConfig from '../../scripts/webpack/env-util';

import '../../public/vendor/flot/jquery.flot';
import '../../public/vendor/flot/jquery.flot.time';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
const global = window as any;

if (getEnvConfig().frontend_dev_fail_tests_on_console || process.env.CI) {
  failOnConsole({ shouldFailOnLog: true, shouldFailOnDebug: true, shouldFailOnInfo: true });
}

// our tests are heavy in CI due to parallelisation and monaco and kusto
// so we increase the default timeout to 2secs to avoid flakiness
configure({ asyncUtilTimeout: 2000 });

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

// Used by useMeasure
global.ResizeObserver = class ResizeObserver {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  static #observationEntry: ResizeObserverEntry = {
    contentRect: {
      x: 1,
      y: 2,
      width: 500,
      height: 500,
      top: 100,
      bottom: 0,
      left: 100,
      right: 0,
    },
    target: {
      // Needed for react-virtual to work in tests
      getAttribute: () => 1,
    },
  } as unknown as ResizeObserverEntry;

  #isObserving = false;
  #callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }

  #emitObservation() {
    setTimeout(() => {
      if (!this.#isObserving) {
        return;
      }

      this.#callback([ResizeObserver.#observationEntry], this);
    });
  }

  observe() {
    this.#isObserving = true;
    this.#emitObservation();
  }

  disconnect() {
    this.#isObserving = false;
  }

  unobserve() {
    this.#isObserving = false;
  }
};
