import { act, render, screen } from '@testing-library/react';
import { type Unsubscribable } from 'rxjs';

import { dateTime, usePluginContext, PluginLoadingStrategy } from '@grafana/data';
import { config, AppPluginConfig } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

import { log } from './logs/log';
import { resetLogMock } from './logs/testUtils';
import {
  deepFreeze,
  handleErrorsInFn,
  getReadOnlyProxy,
  createOpenModalFunction,
  wrapWithPluginContext,
  getExtensionPointPluginDependencies,
  getExposedComponentPluginDependencies,
  getAppPluginConfigs,
  getAppPluginIdFromExposedComponentId,
  getAppPluginDependencies,
  getExtensionPointPluginMeta,
  getMutationObserverProxy,
  readOnlyCopy,
  isReadOnlyProxy,
  isMutationObserverProxy,
} from './utils';

jest.mock('app/features/plugins/pluginSettings', () => ({
  ...jest.requireActual('app/features/plugins/pluginSettings'),
  getPluginSettings: () => Promise.resolve({ info: { version: '1.0.0' } }),
}));

jest.mock('./logs/log', () => {
  const { createLogMock } = jest.requireActual('./logs/testUtils');
  const original = jest.requireActual('./logs/log');

  return {
    ...original,
    log: createLogMock(),
  };
});

describe('Plugin Extensions / Utils', () => {
  describe('deepFreeze()', () => {
    test('should not fail when called with primitive values', () => {
      // Although the type system doesn't allow to call it with primitive values, it can happen that the plugin just ignores these errors.
      // In these cases, we would like to make sure that the function doesn't fail.

      // @ts-ignore
      expect(deepFreeze(1)).toBe(1);
      // @ts-ignore
      expect(deepFreeze('foo')).toBe('foo');
      // @ts-ignore
      expect(deepFreeze(true)).toBe(true);
      // @ts-ignore
      expect(deepFreeze(false)).toBe(false);
      // @ts-ignore
      expect(deepFreeze(undefined)).toBe(undefined);
      // @ts-ignore
      expect(deepFreeze(null)).toBe(null);
    });

    test('should freeze an object so it cannot be overriden', () => {
      const obj = {
        a: 1,
        b: '2',
        c: true,
      };
      const frozen = deepFreeze(obj);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(() => {
        frozen.a = 234;
      }).toThrow(TypeError);
    });

    test('should freeze the primitive properties of an object', () => {
      const obj = {
        a: 1,
        b: '2',
        c: true,
      };
      const frozen = deepFreeze(obj);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(() => {
        frozen.a = 2;
        frozen.b = '3';
        frozen.c = false;
      }).toThrow(TypeError);
    });

    test('should return the same object (but frozen)', () => {
      const obj = {
        a: 1,
        b: '2',
        c: true,
        d: {
          e: {
            f: 'foo',
          },
        },
      };
      const frozen = deepFreeze(obj);

      expect(Object.isFrozen(frozen)).toBe(true);
      expect(frozen).toEqual(obj);
    });

    test('should freeze the nested object properties', () => {
      const obj = {
        a: 1,
        b: {
          c: {
            d: 2,
            e: {
              f: 3,
            },
          },
        },
      };
      const frozen = deepFreeze(obj);

      // Check if the object is frozen
      expect(Object.isFrozen(frozen)).toBe(true);

      // Trying to override a primitive property -> should fail
      expect(() => {
        frozen.a = 2;
      }).toThrow(TypeError);

      // Trying to override an underlying object -> should fail
      expect(Object.isFrozen(frozen.b)).toBe(true);
      expect(() => {
        // @ts-ignore
        frozen.b = {};
      }).toThrow(TypeError);

      // Trying to override deeply nested properties -> should fail
      expect(() => {
        frozen.b.c.e.f = 12345;
      }).toThrow(TypeError);
    });

    test('should not mutate the original object', () => {
      const obj = {
        a: 1,
        b: {
          c: {
            d: 2,
            e: {
              f: 3,
            },
          },
        },
      };
      deepFreeze(obj);

      // We should still be able to override the original object's properties
      expect(Object.isFrozen(obj)).toBe(false);
      expect(() => {
        obj.b.c.d = 12345;
        expect(obj.b.c.d).toBe(12345);
      }).not.toThrow();
    });

    test('should work with nested arrays as well', () => {
      const obj = {
        a: 1,
        b: {
          c: {
            d: [{ e: { f: 1 } }],
          },
        },
      };
      const frozen = deepFreeze(obj);

      // Should be still possible to override the original object
      expect(() => {
        obj.b.c.d[0].e.f = 12345;
        expect(obj.b.c.d[0].e.f).toBe(12345);
      }).not.toThrow();

      // Trying to override the frozen object throws a TypeError
      expect(() => {
        frozen.b.c.d[0].e.f = 6789;
      }).toThrow();

      // The original object should not be mutated
      expect(obj.b.c.d[0].e.f).toBe(12345);

      expect(frozen.b.c.d).toHaveLength(1);
      expect(frozen.b.c.d[0].e.f).toBe(1);
    });

    test('should not blow up when called with an object that contains cycles', () => {
      const obj = {
        a: 1,
        b: {
          c: 123,
        },
      };
      // @ts-ignore
      obj.b.d = obj;
      let frozen: typeof obj;

      // Check if it does not throw due to the cycle in the object
      expect(() => {
        frozen = deepFreeze(obj);
      }).not.toThrow();

      // Check if it did freeze the object
      // @ts-ignore
      expect(Object.isFrozen(frozen)).toBe(true);
      // @ts-ignore
      expect(Object.isFrozen(frozen.b)).toBe(true);
      // @ts-ignore
      expect(Object.isFrozen(frozen.b.d)).toBe(true);
    });
  });

  describe('handleErrorsInFn()', () => {
    test('should catch errors thrown by the provided function and print them as console warnings', () => {
      global.console.warn = jest.fn();

      expect(() => {
        const fn = handleErrorsInFn((foo: string) => {
          throw new Error('Error: ' + foo);
        });

        fn('TEST');

        // Logs the errors
        expect(console.warn).toHaveBeenCalledWith('Error: TEST');
      }).not.toThrow();
    });
  });

  describe('getReadOnlyProxy()', () => {
    it('should not be possible to modify values in proxied object', () => {
      const proxy = getReadOnlyProxy({ a: 'a' });

      expect(() => {
        proxy.a = 'b';
      }).toThrow(TypeError);
    });

    it('should not be possible to modify values in proxied array', () => {
      const proxy = getReadOnlyProxy([1, 2, 3]);

      expect(() => {
        proxy[0] = 2;
      }).toThrow(TypeError);
    });

    it('should not be possible to modify nested objects in proxied object', () => {
      const proxy = getReadOnlyProxy({
        a: {
          c: 'c',
        },
        b: 'b',
      });

      expect(() => {
        proxy.a.c = 'testing';
      }).toThrow(TypeError);
    });

    // This is to record what we are not able to do currently.
    // (Due to Proxy.get() invariants limitations: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/get#invariants)
    it('should not work with any objects that are already frozen', () => {
      const obj = {
        a: {
          b: {
            c: {
              d: 'd',
            },
          },
        },
      };

      Object.freeze(obj);
      Object.freeze(obj.a);
      Object.freeze(obj.a.b);

      const proxy = getReadOnlyProxy(obj);

      expect(() => {
        proxy.a.b.c.d = 'testing';
      }).toThrow(
        "'get' on proxy: property 'a' is a read-only and non-configurable data property on the proxy target but the proxy did not return its actual value (expected '#<Object>' but got '#<Object>')"
      );

      expect(obj.a.b.c.d).toBe('d');
    });

    it('should throw a TypeError if a proxied object is trying to be frozen', () => {
      const obj = {
        a: {
          b: {
            c: {
              d: 'd',
            },
          },
        },
      };

      const proxy = getReadOnlyProxy(obj);

      expect(() => Object.freeze(proxy)).toThrow(TypeError);
      expect(() => Object.freeze(proxy.a)).toThrow(TypeError);
      expect(() => Object.freeze(proxy.a.b)).toThrow(TypeError);

      // Check if the original object is not frozen
      expect(Object.isFrozen(obj)).toBe(false);
      expect(Object.isFrozen(obj.a)).toBe(false);
      expect(Object.isFrozen(obj.a.b)).toBe(false);
    });

    it('should not be possible to modify nested arrays in proxied object', () => {
      const proxy = getReadOnlyProxy({
        a: {
          c: ['c', 'd'],
        },
        b: 'b',
      });

      expect(() => {
        proxy.a.c[0] = 'testing';
      }).toThrow(TypeError);
    });

    it('should be possible to modify source object', () => {
      const source = { a: 'b' };

      getReadOnlyProxy(source);
      source.a = 'c';

      expect(source.a).toBe('c');
    });

    it('should be possible to modify source array', () => {
      const source = ['a', 'b'];

      getReadOnlyProxy(source);
      source[0] = 'c';

      expect(source[0]).toBe('c');
    });

    it('should be possible to modify nedsted objects in source object', () => {
      const source = { a: { b: 'c' } };

      getReadOnlyProxy(source);
      source.a.b = 'd';

      expect(source.a.b).toBe('d');
    });

    it('should be possible to modify nedsted arrays in source object', () => {
      const source = { a: { b: ['c', 'd'] } };

      getReadOnlyProxy(source);
      source.a.b[0] = 'd';

      expect(source.a.b[0]).toBe('d');
    });

    it('should be possible to call functions in proxied object', () => {
      const proxy = getReadOnlyProxy({
        a: () => 'testing',
      });

      expect(proxy.a()).toBe('testing');
    });

    it('should return a clone of moment/datetime in context', () => {
      const source = dateTime('2023-10-26T18:25:01Z');
      const proxy = getReadOnlyProxy({
        a: source,
      });

      expect(source.isSame(proxy.a)).toBe(true);
      expect(source).not.toBe(proxy.a);
    });
  });

  describe('getMutationObserverProxy()', () => {
    it('should not be possible to modify values in proxied object, but logs a warning', () => {
      const proxy = getMutationObserverProxy({ a: 'a' });

      expect(() => {
        proxy.a = 'b';
      }).not.toThrow();

      expect(log.warning).toHaveBeenCalledWith(`Attempted to mutate object property "a"`, {
        stack: expect.any(String),
      });

      expect(proxy.a).toBe('b');
    });

    it('should be possible to set new values, but logs a warning', () => {
      const obj: { a: string; b?: string } = { a: 'a' };
      const proxy = getMutationObserverProxy(obj);

      expect(() => {
        Object.defineProperty(proxy, 'b', {
          value: 'b',
          writable: false,
        });
      }).not.toThrow();

      expect(log.warning).toHaveBeenCalledWith(`Attempted to define object property "b"`, {
        stack: expect.any(String),
      });

      expect(proxy.b).toBe('b');
    });

    it('should be possible to delete properties, but logs a warning', () => {
      const proxy = getMutationObserverProxy({
        a: {
          c: 'c',
        },
        b: 'b',
      });

      expect(() => {
        // @ts-ignore - This is to test the logic
        delete proxy.a.c;
      }).not.toThrow();

      expect(log.warning).toHaveBeenCalledWith(`Attempted to delete object property "c"`, {
        stack: expect.any(String),
      });

      expect(proxy.a.c).toBeUndefined();
    });
  });

  describe('readOnlyCopy()', () => {
    const originalEnv = config.buildInfo.env;

    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation();
      config.featureToggles.extensionsReadOnlyProxy = false;
    });

    afterEach(() => {
      config.buildInfo.env = originalEnv;
      jest.mocked(console.warn).mockClear();
    });

    it('should return the same value for primitive types', () => {
      expect(readOnlyCopy(1)).toBe(1);
      expect(readOnlyCopy('a')).toBe('a');
      expect(readOnlyCopy(true)).toBe(true);
      expect(readOnlyCopy(false)).toBe(false);
      expect(readOnlyCopy(null)).toBe(null);
      expect(readOnlyCopy(undefined)).toBe(undefined);
    });

    it('should return a read-only proxy of the original object if the feature flag is enabled', () => {
      config.featureToggles.extensionsReadOnlyProxy = true;

      const obj = { a: 'a' };
      const copy = readOnlyCopy(obj);

      expect(copy).not.toBe(obj);
      expect(copy.a).toBe('a');
      expect(isReadOnlyProxy(copy)).toBe(true);
      expect(() => {
        copy.a = 'b';
      }).toThrow(TypeError);
    });

    it('should return a read-only proxy of a deep-copy of the original object in dev mode', () => {
      config.featureToggles.extensionsReadOnlyProxy = false;
      config.buildInfo.env = 'development';

      const obj = { a: 'a' };
      const copy = readOnlyCopy(obj);

      expect(copy).not.toBe(obj);
      expect(copy.a).toBe('a');
      expect(isReadOnlyProxy(copy)).toBe(true);
      expect(() => {
        copy.a = 'b';
      }).toThrow(TypeError);

      // Also test that we can handle frozen objects
      // (This is not possible with getReadOnlyProxy, as it throws an error when the object is already frozen)
      const obj2 = {
        a: {
          b: {
            c: {
              d: 'd',
            },
          },
        },
      };

      Object.freeze(obj2);
      Object.freeze(obj2.a);
      Object.freeze(obj2.a.b);

      const copy2 = readOnlyCopy(obj2);

      expect(() => {
        copy2.a.b.c.d = 'testing';
      }).toThrow("'set' on proxy: trap returned falsish for property 'd'");

      expect(copy2.a.b.c.d).toBe('d');
    });

    it('should return a writable deep-copy of the original object in production mode', () => {
      config.featureToggles.extensionsReadOnlyProxy = false;
      config.buildInfo.env = 'production';

      const obj = { a: 'a' };
      const copy = readOnlyCopy(obj);

      expect(copy).not.toBe(obj);
      expect(copy.a).toBe('a');
      expect(isMutationObserverProxy(copy)).toBe(true);
      expect(() => {
        copy.a = 'b';
      }).not.toThrow();

      expect(log.warning).toHaveBeenCalledWith(`Attempted to mutate object property "a"`, {
        stack: expect.any(String),
      });

      expect(copy.a).toBe('b');
    });

    it('should allow freezing the object in production mode', () => {
      config.featureToggles.extensionsReadOnlyProxy = false;
      config.buildInfo.env = 'production';

      const obj = { a: 'a', b: { c: 'c' } };
      const copy = readOnlyCopy(obj);

      expect(() => {
        Object.freeze(copy);
        Object.freeze(copy.b);
      }).not.toThrow();

      expect(Object.isFrozen(copy)).toBe(true);
      expect(Object.isFrozen(copy.b)).toBe(true);
      expect(copy.b).toEqual({ c: 'c' });

      expect(log.warning).toHaveBeenCalledWith(`Attempted to define object property "a"`, {
        stack: expect.any(String),
      });
    });
  });

  describe('createOpenModalFunction()', () => {
    let renderModalSubscription: Unsubscribable | undefined;

    beforeAll(() => {
      renderModalSubscription = appEvents.subscribe(ShowModalReactEvent, (event) => {
        const { payload } = event;
        const Modal = payload.component;
        render(<Modal />);
      });
    });

    afterAll(() => {
      renderModalSubscription?.unsubscribe();
    });

    it('should open modal with provided title and body', async () => {
      const pluginId = 'grafana-worldmap-panel';
      const openModal = createOpenModalFunction(pluginId);

      openModal({
        title: 'Title in modal',
        body: () => <div>Text in body</div>,
      });

      expect(await screen.findByRole('dialog')).toBeVisible();
      expect(screen.getByRole('heading')).toHaveTextContent('Title in modal');
      expect(screen.getByText('Text in body')).toBeVisible();
    });

    it('should open modal with default width if not specified', async () => {
      const pluginId = 'grafana-worldmap-panel';
      const openModal = createOpenModalFunction(pluginId);

      openModal({
        title: 'Title in modal',
        body: () => <div>Text in body</div>,
      });

      const modal = await screen.findByRole('dialog');
      const style = window.getComputedStyle(modal);

      expect(style.width).toBe('750px');
      expect(style.height).toBe('');
    });

    it('should open modal with specified width', async () => {
      const pluginId = 'grafana-worldmap-panel';
      const openModal = createOpenModalFunction(pluginId);

      openModal({
        title: 'Title in modal',
        body: () => <div>Text in body</div>,
        width: '70%',
      });

      const modal = await screen.findByRole('dialog');
      const style = window.getComputedStyle(modal);

      expect(style.width).toBe('70%');
    });

    it('should open modal with specified height', async () => {
      const pluginId = 'grafana-worldmap-panel';
      const openModal = createOpenModalFunction(pluginId);

      openModal({
        title: 'Title in modal',
        body: () => <div>Text in body</div>,
        height: 600,
      });

      const modal = await screen.findByRole('dialog');
      const style = window.getComputedStyle(modal);

      expect(style.height).toBe('600px');
    });

    it('should open modal with the plugin context being available', async () => {
      const pluginId = 'grafana-worldmap-panel';
      const openModal = createOpenModalFunction(pluginId);

      const ModalContent = () => {
        const context = usePluginContext();

        return <div>Version: {context!.meta.info.version}</div>;
      };

      openModal({
        title: 'Title in modal',
        body: ModalContent,
      });

      const modal = await screen.findByRole('dialog');
      expect(modal).toHaveTextContent('Version: 1.0.0');
    });
  });

  describe('wrapWithPluginContext()', () => {
    type ExampleComponentProps = {
      a: {
        b: {
          c: string;
        };
      };
      override?: boolean;
    };

    const ExampleComponent = (props: ExampleComponentProps) => {
      const pluginContext = usePluginContext();

      const audience = props.a.b.c || 'Grafana';

      if (props.override) {
        props.a.b.c = 'OVERRIDE';
      }

      return (
        <div>
          <h1>Hello {audience}!</h1> Version: {pluginContext!.meta.info.version}
        </div>
      );
    };

    beforeEach(() => {
      resetLogMock(log);
    });

    it('should make the plugin context available for the wrapped component', async () => {
      const pluginId = 'grafana-worldmap-panel';
      const Component = wrapWithPluginContext(pluginId, ExampleComponent, log);

      render(<Component a={{ b: { c: 'Grafana' } }} />);

      expect(await screen.findByText('Hello Grafana!')).toBeVisible();
      expect(screen.getByText('Version: 1.0.0')).toBeVisible();
    });

    it('should pass the properties into the wrapped component', async () => {
      const pluginId = 'grafana-worldmap-panel';
      const Component = wrapWithPluginContext(pluginId, ExampleComponent, log);

      render(<Component a={{ b: { c: 'Grafana' } }} />);

      expect(await screen.findByText('Hello Grafana!')).toBeVisible();
      expect(screen.getByText('Version: 1.0.0')).toBeVisible();
    });

    it('should not be possible to mutate the props in development mode, and it also throws an error', async () => {
      config.buildInfo.env = 'development';
      const pluginId = 'grafana-worldmap-panel';
      const Component = wrapWithPluginContext(pluginId, ExampleComponent, log);
      const props = { a: { b: { c: 'Grafana' } } };

      jest.spyOn(console, 'error').mockImplementation();

      await expect(async () => {
        await act(async () => {
          render(<Component {...props} override />);
        });
      }).rejects.toThrow(`'set' on proxy: trap returned falsish for property 'c'`);

      // Logs an error
      expect(console.error).toHaveBeenCalledWith(expect.any(String));

      // Not able to mutate the props in development mode
      expect(props.a.b.c).toBe('Grafana');
    });

    it('should not be possible to mutate the props in production mode either, but it logs a warning', async () => {
      config.buildInfo.env = 'production';
      const pluginId = 'grafana-worldmap-panel';
      const Component = wrapWithPluginContext(pluginId, ExampleComponent, log);
      const props = { a: { b: { c: 'Grafana' } } };

      render(<Component {...props} override />);

      expect(await screen.findByText('Hello Grafana!')).toBeVisible();

      // Logs a warning
      expect(log.warning).toHaveBeenCalledTimes(1);
      expect(log.warning).toHaveBeenCalledWith(`Attempted to mutate object property "c"`, {
        stack: expect.any(String),
      });

      // Not able to mutate the props in production mode either
      expect(props.a.b.c).toBe('Grafana');
    });
  });

  describe('getAppPluginConfigs()', () => {
    const originalApps = config.apps;
    const genereicAppPluginConfig = {
      path: '',
      version: '',
      preload: false,
      angular: {
        detected: false,
        hideDeprecation: false,
      },
      loadingStrategy: PluginLoadingStrategy.fetch,
      dependencies: {
        grafanaVersion: '8.0.0',
        plugins: [],
        extensions: {
          exposedComponents: [],
        },
      },
      extensions: {
        addedLinks: [],
        addedComponents: [],
        addedFunctions: [],
        exposedComponents: [],
        extensionPoints: [],
      },
    };

    afterEach(() => {
      config.apps = originalApps;
    });

    test('should return the app plugin configs based on the provided plugin ids', () => {
      config.apps = {
        'myorg-first-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-first-app',
        },
        'myorg-second-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-second-app',
        },
        'myorg-third-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-third-app',
        },
      };

      expect(getAppPluginConfigs(['myorg-first-app', 'myorg-third-app'])).toEqual([
        config.apps['myorg-first-app'],
        config.apps['myorg-third-app'],
      ]);
    });

    test('should simply ignore the app plugin ids that do not belong to a config', () => {
      config.apps = {
        'myorg-first-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-first-app',
        },
        'myorg-second-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-second-app',
        },
        'myorg-third-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-third-app',
        },
      };

      expect(getAppPluginConfigs(['myorg-first-app', 'unknown-app-id'])).toEqual([config.apps['myorg-first-app']]);
    });
  });

  describe('getAppPluginIdFromExposedComponentId()', () => {
    test('should return the app plugin id from an extension point id', () => {
      expect(getAppPluginIdFromExposedComponentId('myorg-extensions-app/component/v1')).toBe('myorg-extensions-app');
    });
  });

  describe('getExtensionPointPluginDependencies()', () => {
    const originalApps = config.apps;
    const genereicAppPluginConfig = {
      path: '',
      version: '',
      preload: false,
      angular: {
        detected: false,
        hideDeprecation: false,
      },
      loadingStrategy: PluginLoadingStrategy.fetch,
      dependencies: {
        grafanaVersion: '8.0.0',
        plugins: [],
        extensions: {
          exposedComponents: [],
        },
      },
      extensions: {
        addedLinks: [],
        addedComponents: [],
        addedFunctions: [],
        exposedComponents: [],
        extensionPoints: [],
      },
    };

    afterEach(() => {
      config.apps = originalApps;
    });

    test('should return the app plugin ids that register extensions to a link extension point', () => {
      const extensionPointId = 'myorg-first-app/link/v1';

      config.apps = {
        'myorg-first-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-first-app',
        },
        // This plugin is registering a link extension to the extension point
        'myorg-second-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-second-app',
          extensions: {
            addedLinks: [
              {
                targets: [extensionPointId],
                title: 'Link title',
              },
            ],
            addedComponents: [],
            exposedComponents: [],
            extensionPoints: [],
            addedFunctions: [],
          },
        },
        'myorg-third-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-third-app',
        },
      };

      const appPluginIds = getExtensionPointPluginDependencies(extensionPointId);

      expect(appPluginIds).toEqual(['myorg-second-app']);
    });

    test('should return the app plugin ids that register extensions to a component extension point', () => {
      const extensionPointId = 'myorg-first-app/component/v1';

      config.apps = {
        'myorg-first-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-first-app',
        },
        'myorg-second-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-second-app',
        },
        // This plugin is registering a component extension to the extension point
        'myorg-third-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-third-app',
          extensions: {
            addedLinks: [],
            addedComponents: [
              {
                targets: [extensionPointId],
                title: 'Component title',
              },
            ],
            exposedComponents: [],
            extensionPoints: [],
            addedFunctions: [],
          },
        },
      };

      const appPluginIds = getExtensionPointPluginDependencies(extensionPointId);

      expect(appPluginIds).toEqual(['myorg-third-app']);
    });

    test('should return an empty array if there are no apps that that extend the extension point', () => {
      const extensionPointId = 'myorg-first-app/component/v1';

      // None of the apps are extending the extension point
      config.apps = {
        'myorg-first-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-first-app',
        },
        'myorg-second-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-second-app',
        },
        'myorg-third-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-third-app',
        },
      };

      const appPluginIds = getExtensionPointPluginDependencies(extensionPointId);

      expect(appPluginIds).toEqual([]);
    });

    test('should also return (recursively) the app plugin ids that the apps which extend the extension-point depend on', () => {
      const extensionPointId = 'myorg-first-app/component/v1';

      config.apps = {
        'myorg-first-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-first-app',
        },
        // This plugin is registering a component extension to the extension point.
        // It is also depending on the 'myorg-fourth-app' plugin.
        'myorg-second-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-second-app',
          extensions: {
            addedLinks: [],
            addedComponents: [
              {
                targets: [extensionPointId],
                title: 'Component title',
              },
            ],
            exposedComponents: [],
            extensionPoints: [],
            addedFunctions: [],
          },
          dependencies: {
            ...genereicAppPluginConfig.dependencies,
            extensions: {
              exposedComponents: ['myorg-fourth-app/component/v1'],
            },
          },
        },
        'myorg-third-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-third-app',
        },
        // This plugin exposes a component, but is also depending on the 'myorg-fifth-app'.
        'myorg-fourth-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-fourth-app',
          extensions: {
            addedLinks: [],
            addedComponents: [],
            exposedComponents: [
              {
                id: 'myorg-fourth-app/component/v1',
                title: 'Exposed component',
              },
            ],
            extensionPoints: [],
            addedFunctions: [],
          },
          dependencies: {
            ...genereicAppPluginConfig.dependencies,
            extensions: {
              exposedComponents: ['myorg-fifth-app/component/v1'],
            },
          },
        },
        'myorg-fifth-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-fifth-app',
          extensions: {
            addedLinks: [],
            addedComponents: [],
            exposedComponents: [
              {
                id: 'myorg-fifth-app/component/v1',
                title: 'Exposed component',
              },
            ],
            extensionPoints: [],
            addedFunctions: [],
          },
        },
        'myorg-sixth-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-sixth-app',
        },
      };

      const appPluginIds = getExtensionPointPluginDependencies(extensionPointId);

      expect(appPluginIds).toEqual(['myorg-second-app', 'myorg-fourth-app', 'myorg-fifth-app']);
    });
  });

  describe('getExposedComponentPluginDependencies()', () => {
    const originalApps = config.apps;
    const genereicAppPluginConfig = {
      path: '',
      version: '',
      preload: false,
      angular: {
        detected: false,
        hideDeprecation: false,
      },
      loadingStrategy: PluginLoadingStrategy.fetch,
      dependencies: {
        grafanaVersion: '8.0.0',
        plugins: [],
        extensions: {
          exposedComponents: [],
        },
      },
      extensions: {
        addedLinks: [],
        addedComponents: [],
        exposedComponents: [],
        extensionPoints: [],
        addedFunctions: [],
      },
    };

    afterEach(() => {
      config.apps = originalApps;
    });

    test('should only return the app plugin id that exposes the component, if that component does not depend on anything', () => {
      const exposedComponentId = 'myorg-second-app/component/v1';

      config.apps = {
        'myorg-first-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-first-app',
        },
        'myorg-second-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-second-app',
          extensions: {
            addedLinks: [],
            addedComponents: [],
            exposedComponents: [
              {
                id: exposedComponentId,
                title: 'Component title',
              },
            ],
            extensionPoints: [],
            addedFunctions: [],
          },
        },
        'myorg-third-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-third-app',
        },
      };

      const appPluginIds = getExposedComponentPluginDependencies(exposedComponentId);

      expect(appPluginIds).toEqual(['myorg-second-app']);
    });

    test('should also return the list of app plugin ids that the plugin - which exposes the component - is depending on', () => {
      const exposedComponentId = 'myorg-second-app/component/v1';

      config.apps = {
        'myorg-first-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-first-app',
        },
        'myorg-second-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-second-app',
          extensions: {
            addedLinks: [],
            addedComponents: [],
            exposedComponents: [
              {
                id: exposedComponentId,
                title: 'Component title',
              },
            ],
            extensionPoints: [],
            addedFunctions: [],
          },
          dependencies: {
            ...genereicAppPluginConfig.dependencies,
            extensions: {
              exposedComponents: ['myorg-fourth-app/component/v1'],
            },
          },
        },
        'myorg-third-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-third-app',
        },
        'myorg-fourth-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-fourth-app',
          extensions: {
            addedLinks: [],
            addedComponents: [],
            exposedComponents: [
              {
                id: 'myorg-fourth-app/component/v1',
                title: 'Component title',
              },
            ],
            extensionPoints: [],
            addedFunctions: [],
          },
          dependencies: {
            ...genereicAppPluginConfig.dependencies,
            extensions: {
              exposedComponents: ['myorg-fifth-app/component/v1'],
            },
          },
        },
        'myorg-fifth-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-fifth-app',
          extensions: {
            addedLinks: [],
            addedComponents: [],
            exposedComponents: [
              {
                id: 'myorg-fifth-app/component/v1',
                title: 'Component title',
              },
            ],
            extensionPoints: [],
            addedFunctions: [],
          },
        },
      };

      const appPluginIds = getExposedComponentPluginDependencies(exposedComponentId);

      expect(appPluginIds).toEqual(['myorg-second-app', 'myorg-fourth-app', 'myorg-fifth-app']);
    });
  });

  describe('getAppPluginDependencies()', () => {
    const originalApps = config.apps;
    const genereicAppPluginConfig = {
      path: '',
      version: '',
      preload: false,
      angular: {
        detected: false,
        hideDeprecation: false,
      },
      loadingStrategy: PluginLoadingStrategy.fetch,
      dependencies: {
        grafanaVersion: '8.0.0',
        plugins: [],
        extensions: {
          exposedComponents: [],
        },
      },
      extensions: {
        addedLinks: [],
        addedComponents: [],
        addedFunctions: [],
        exposedComponents: [],
        extensionPoints: [],
      },
    };

    afterEach(() => {
      config.apps = originalApps;
    });

    test('should not end up in an infinite loop if there are circular dependencies', () => {
      config.apps = {
        'myorg-first-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-first-app',
        },
        'myorg-second-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-second-app',
          dependencies: {
            ...genereicAppPluginConfig.dependencies,
            extensions: {
              exposedComponents: ['myorg-third-app/link/v1'],
            },
          },
        },
        'myorg-third-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-third-app',
          dependencies: {
            ...genereicAppPluginConfig.dependencies,
            extensions: {
              exposedComponents: ['myorg-second-app/link/v1'],
            },
          },
        },
      };

      const appPluginIds = getAppPluginDependencies('myorg-second-app');

      expect(appPluginIds).toEqual(['myorg-third-app']);
    });

    test('should not end up in an infinite loop if a plugin depends on itself', () => {
      config.apps = {
        'myorg-first-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-first-app',
        },
        'myorg-second-app': {
          ...genereicAppPluginConfig,
          id: 'myorg-second-app',
          dependencies: {
            ...genereicAppPluginConfig.dependencies,
            extensions: {
              // Not a valid scenario!
              // (As this is sometimes happening out in the wild, we thought it's better to also cover it with a test-case.)
              exposedComponents: ['myorg-second-app/link/v1'],
            },
          },
        },
      };

      const appPluginIds = getAppPluginDependencies('myorg-second-app');

      expect(appPluginIds).toEqual([]);
    });
  });

  describe('getExtensionPointPluginMeta()', () => {
    const originalApps = config.apps;
    const mockExtensionPointId = 'test-extension-point';
    const mockApp1: AppPluginConfig = {
      id: 'app1',
      path: 'app1',
      version: '1.0.0',
      preload: false,
      angular: { detected: false, hideDeprecation: false },
      loadingStrategy: PluginLoadingStrategy.fetch,
      dependencies: {
        grafanaVersion: '8.0.0',
        plugins: [],
        extensions: {
          exposedComponents: [],
        },
      },
      extensions: {
        addedComponents: [
          { title: 'Component 1', targets: [mockExtensionPointId] },
          { title: 'Component 2', targets: ['other-point'] },
        ],
        addedLinks: [
          { title: 'Link 1', targets: [mockExtensionPointId] },
          { title: 'Link 2', targets: ['other-point'] },
        ],
        addedFunctions: [],
        exposedComponents: [],
        extensionPoints: [],
      },
    };

    const mockApp2: AppPluginConfig = {
      id: 'app2',
      path: 'app2',
      version: '1.0.0',
      preload: false,
      angular: { detected: false, hideDeprecation: false },
      loadingStrategy: PluginLoadingStrategy.fetch,
      dependencies: {
        grafanaVersion: '8.0.0',
        plugins: [],
        extensions: {
          exposedComponents: [],
        },
      },
      extensions: {
        addedComponents: [{ title: 'Component 3', targets: [mockExtensionPointId] }],
        addedLinks: [],
        addedFunctions: [],
        exposedComponents: [],
        extensionPoints: [],
      },
    };

    beforeEach(() => {
      config.apps = {};
    });

    afterEach(() => {
      config.apps = originalApps;
    });

    it('should return empty map when no plugins have extensions for the point', () => {
      config.apps = {
        app1: { ...mockApp1, extensions: { ...mockApp1.extensions, addedComponents: [], addedLinks: [] } },
        app2: { ...mockApp2, extensions: { ...mockApp2.extensions, addedComponents: [], addedLinks: [] } },
      };

      const result = getExtensionPointPluginMeta(mockExtensionPointId);
      expect(result.size).toBe(0);
    });

    it('should return map with plugins that have components for the extension point', () => {
      config.apps = {
        app1: mockApp1,
        app2: mockApp2,
      };

      const result = getExtensionPointPluginMeta(mockExtensionPointId);

      expect(result.size).toBe(2);
      expect(result.get('app1')).toEqual({
        addedComponents: [{ title: 'Component 1', targets: [mockExtensionPointId] }],
        addedLinks: [{ title: 'Link 1', targets: [mockExtensionPointId] }],
      });
      expect(result.get('app2')).toEqual({
        addedComponents: [{ title: 'Component 3', targets: [mockExtensionPointId] }],
        addedLinks: [],
      });
    });

    it('should filter out plugins that do not have any extensions for the point', () => {
      config.apps = {
        app1: mockApp1,
        app2: { ...mockApp2, extensions: { ...mockApp2.extensions, addedComponents: [], addedLinks: [] } },
        app3: {
          ...mockApp1,
          id: 'app3',
          extensions: {
            ...mockApp1.extensions,
            addedComponents: [{ title: 'Component 4', targets: ['other-point'] }],
            addedLinks: [{ title: 'Link 3', targets: ['other-point'] }],
          },
        },
      };

      const result = getExtensionPointPluginMeta(mockExtensionPointId);

      expect(result.size).toBe(1);
      expect(result.get('app1')).toEqual({
        addedComponents: [{ title: 'Component 1', targets: [mockExtensionPointId] }],
        addedLinks: [{ title: 'Link 1', targets: [mockExtensionPointId] }],
      });
    });
  });
});
