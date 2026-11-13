const { createRequire } = require('node:module');
const { isAbsolute } = require('node:path');
const { runInContext } = require('node:vm');
const HappyDOMEnvironment = require('@happy-dom/jest-environment').default;

function isStandardCircus(testRunner) {
  if (typeof testRunner !== 'string' || !isAbsolute(testRunner)) {
    return false;
  }
  try {
    // Resolve from the runner itself: pnpm need not expose Jest's transitive dependencies here.
    return createRequire(testRunner).resolve('jest-circus/runner') === testRunner;
  } catch {
    return false;
  }
}

function createDOMException(context) {
  // Keep Node's DOMException branding and lazy stack, but inherit from the test realm's Error.
  // Otherwise core-js replaces Happy DOM's cross-realm exception with an eager-stack polyfill.
  const { DOMException, wrapGetter } = runInContext(
    `
    (NativeDOMException, NativeTypeError) => {
      class DOMException extends Error {
        constructor(...args) {
          try {
            return Reflect.construct(NativeDOMException, args, new.target);
          } catch (error) {
            if (error instanceof NativeTypeError) throw new TypeError(error.message);
            throw error;
          }
        }
      }
      const wrapGetter = (get) => function () {
        try {
          return Reflect.apply(get, this, []);
        } catch (error) {
          if (error instanceof NativeTypeError) throw new TypeError(error.message);
          throw error;
        }
      };
      return { DOMException, wrapGetter };
    }
  `,
    context
  )(globalThis.DOMException, TypeError);
  const descriptors = Object.getOwnPropertyDescriptors(globalThis.DOMException.prototype);
  delete descriptors.constructor;
  for (const descriptor of Object.values(descriptors)) {
    if (descriptor.get) descriptor.get = wrapGetter(descriptor.get);
  }
  Object.defineProperties(DOMException.prototype, descriptors);
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(globalThis.DOMException))) {
    if (typeof descriptor.value === 'number') Object.defineProperty(DOMException, name, descriptor);
  }
  return DOMException;
}

module.exports = class GrafanaHappyDOMEnvironment extends HappyDOMEnvironment {
  constructor(config, context) {
    const projectConfig = config.projectConfig;
    const options = projectConfig.testEnvironmentOptions;

    super(
      {
        ...config,
        projectConfig: {
          ...projectConfig,
          testEnvironmentOptions: {
            ...options,
            settings: {
              ...options.settings,
              // FingerprintJS needs a blank child document, not a fetched iframe page.
              enableIframePageLoading: true,
              navigation: {
                ...options.settings?.navigation,
                disableMainFrameNavigation: true,
                disableChildFrameNavigation: true,
                disableChildPageNavigation: true,
                disableFallbackToSetURL: true,
              },
            },
          },
        },
      },
      context
    );

    this.global.DOMException = createDOMException(this.getVmContext());

    // Happy DOM exposes Node's observers, which otherwise outlive the window and retain test runtimes.
    const NativePerformanceObserver = this.global.PerformanceObserver;
    const disconnect = NativePerformanceObserver.prototype.disconnect;
    const performanceObservers = new Set();
    this.global.PerformanceObserver = class PerformanceObserver extends NativePerformanceObserver {
      observe(...args) {
        super.observe(...args);
        performanceObservers.add(this);
      }
      disconnect() {
        super.disconnect();
        performanceObservers.delete(this);
      }
    };
    this.disconnectPerformanceObservers = () => {
      for (const observer of performanceObservers) {
        disconnect.call(observer);
      }
      performanceObservers.clear();
    };

    if (isStandardCircus(projectConfig.testRunner)) {
      // Only Jasmine needs upstream's per-call stack inspection; leave other runners unchanged.
      // Match Happy DOM's instance binding, keeping task tracking and detached calls intact.
      // Upstream initializes fake timers before wrapping setTimeout; leave those objects alone.
      this.global.setTimeout = Object.getPrototypeOf(this.window).setTimeout.bind(this.window);
    }

    const { document, Element, HTMLElement } = this.global;
    if (!document.doctype) {
      document.insertBefore(document.implementation.createDocumentType('html', '', ''), document.documentElement);
    }

    // Keep Element-level geometry mocks effective in both DOM implementations.
    for (const name of ['clientWidth', 'clientHeight']) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
      if (!Object.getOwnPropertyDescriptor(Element.prototype, name) && descriptor?.configurable) {
        Object.defineProperty(Element.prototype, name, descriptor);
        delete HTMLElement.prototype[name];
      }
    }

    // Happy DOM shares DOM prototypes across windows, unlike jsdom. Direct geometry
    // mocks must not leak into the next test file scheduled on this Jest worker.
    this.prototypeDescriptors = new Map();
    const intrinsicPrototypes = new Set([
      Object.prototype,
      Function.prototype,
      this.global.Object.prototype,
      this.global.Function.prototype,
    ]);
    for (const [name, { value }] of Object.entries(Object.getOwnPropertyDescriptors(this.global))) {
      if (!/^[A-Z]/.test(name) || typeof value !== 'function') {
        continue;
      }
      let prototype = value.prototype;
      while (prototype && !intrinsicPrototypes.has(prototype) && !this.prototypeDescriptors.has(prototype)) {
        this.prototypeDescriptors.set(prototype, Object.getOwnPropertyDescriptors(prototype));
        prototype = Object.getPrototypeOf(prototype);
      }
    }
  }

  async handleTestEvent(event, state) {
    await super.handleTestEvent?.(event, state);
    if (event.name === 'test_done') {
      // Circus has finished afterEach hooks; cancel browser work before the next test reuses the window.
      await this.global.happyDOM.abort();
    }
  }

  async teardown() {
    const happyDOM = this.global?.happyDOM;
    if (!happyDOM) {
      return;
    }
    try {
      await super.teardown();
    } finally {
      try {
        this.disconnectPerformanceObservers();
        // window.close() ignores root windows. The detached API also releases Happy DOM's frame registry.
        await happyDOM.close();
      } finally {
        for (const [prototype, descriptors] of this.prototypeDescriptors) {
          for (const key of Reflect.ownKeys(prototype)) {
            if (!Object.hasOwn(descriptors, key)) {
              delete prototype[key];
            }
          }
          Object.defineProperties(prototype, descriptors);
        }
        this.prototypeDescriptors.clear();
      }
    }
  }
};
