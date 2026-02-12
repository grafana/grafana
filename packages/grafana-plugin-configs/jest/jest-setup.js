import '@testing-library/jest-dom';
import { MessageChannel } from 'node:worker_threads';
import { TextEncoder, TextDecoder } from 'util';

import { matchers } from '@grafana/test-utils/matchers';

expect.extend(matchers);

Object.assign(global, { TextDecoder, TextEncoder });

// https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(global, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

const mockIntersectionObserver = jest.fn().mockImplementation((callback) => ({
  observe: jest.fn().mockImplementation((elem) => {
    callback([{ target: elem, isIntersecting: true }]);
  }),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
global.IntersectionObserver = mockIntersectionObserver;

Object.defineProperty(document, 'fonts', {
  value: { ready: Promise.resolve({}) },
});

// Used by useMeasure
global.ResizeObserver = class ResizeObserver {
  static #observationEntry = {
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
  };

  #isObserving = false;
  #callback;

  constructor(callback) {
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
