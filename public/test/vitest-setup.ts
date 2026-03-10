// This import has side effects, and must be at the top so jQuery is made global first
import './global-jquery-shim';

import { MessageChannel, MessagePort } from 'node:worker_threads';
import { vi } from 'vitest';

// eslint-disable-next-line import/order
import { EventBusSrv } from '@grafana/data';

const testAppEvents = new EventBusSrv();

// we need to isolate the `@grafana/data` module here now that it depends on `@grafana/i18n`
vi.doMock('../app/core/app_events', async () => {
  const actual = await import('../app/core/app_events');
  return {
    ...actual,
    appEvents: testAppEvents,
  };
});

import { GrafanaBootConfig } from '@grafana/runtime';

import 'blob-polyfill';
import 'mutationobserver-shim';
import './mocks/vitestWorkers';

import '../vendor/flot/jquery.flot';
import '../vendor/flot/jquery.flot.time';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const global = window as any;

// mock the default window.grafanaBootData settings
const settings: Partial<GrafanaBootConfig> = {
  featureToggles: {},
};
global.grafanaBootData = {
  settings,
  user: {
    locale: 'en-US',
  },
  navTree: [],
};

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
      callback([{ target: elem, isIntersecting: true }] as unknown as IntersectionObserverEntry[]);
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
});
global.IntersectionObserver = mockIntersectionObserver;
Object.defineProperty(document, 'fonts', {
  value: { ready: Promise.resolve({}) },
});

// add scrollTo interface since it's not implemented in jsdom
Element.prototype.scrollTo = () => {};

const throwUnhandledRejections = () => {
  process.on('unhandledRejection', (err) => {
    throw err;
  });
};

throwUnhandledRejections();

// Used by useMeasure
global.ResizeObserver = class ResizeObserver {
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

// originally using just global.MessageChannel = MessageChannel
// however this results in open handles in jest tests
// see https://github.com/facebook/react/issues/26608#issuecomment-1734172596
global.MessageChannel = class {
  port1: MessagePort;
  port2: MessagePort;
  constructor() {
    const channel = new MessageChannel();
    this.port1 = new Proxy(channel.port1, {
      set(port1, prop, value) {
        const result = Reflect.set(port1, prop, value);
        if (prop === 'onmessage') {
          port1.unref();
        }
        return result;
      },
    });
    this.port2 = channel.port2;
  }
};
global.BroadcastChannel = class BroadcastChannel {
  onmessage() {}
  onmessageerror() {}
  postMessage(data: unknown) {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
};
