import { render, screen } from '@testing-library/react';
import { type Unsubscribable } from 'rxjs';

import { dateTime, usePluginContext } from '@grafana/data';
import appEvents from 'app/core/app_events';
import { ShowModalReactEvent } from 'app/types/events';

import { log } from './logs/log';
import {
  deepFreeze,
  handleErrorsInFn,
  getReadOnlyProxy,
  createOpenModalFunction,
  wrapWithPluginContext,
} from './utils';

jest.mock('app/features/plugins/pluginSettings', () => ({
  ...jest.requireActual('app/features/plugins/pluginSettings'),
  getPluginSettings: () => Promise.resolve({ info: { version: '1.0.0' } }),
}));

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
      }).toThrowError(TypeError);
    });

    it('should not be possible to modify values in proxied array', () => {
      const proxy = getReadOnlyProxy([1, 2, 3]);

      expect(() => {
        proxy[0] = 2;
      }).toThrowError(TypeError);
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
      }).toThrowError(TypeError);
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
      }).toThrowError(TypeError);
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

  describe('wrapExtensionComponentWithContext()', () => {
    type ExampleComponentProps = {
      audience?: string;
    };

    const ExampleComponent = (props: ExampleComponentProps) => {
      const pluginContext = usePluginContext();

      const audience = props.audience || 'Grafana';

      return (
        <div>
          <h1>Hello {audience}!</h1> Version: {pluginContext!.meta.info.version}
        </div>
      );
    };

    it('should make the plugin context available for the wrapped component', async () => {
      const pluginId = 'grafana-worldmap-panel';
      const Component = wrapWithPluginContext(pluginId, ExampleComponent, log);

      render(<Component />);

      expect(await screen.findByText('Hello Grafana!')).toBeVisible();
      expect(screen.getByText('Version: 1.0.0')).toBeVisible();
    });

    it('should pass the properties into the wrapped component', async () => {
      const pluginId = 'grafana-worldmap-panel';
      const Component = wrapWithPluginContext(pluginId, ExampleComponent, log);

      render(<Component audience="folks" />);

      expect(await screen.findByText('Hello folks!')).toBeVisible();
      expect(screen.getByText('Version: 1.0.0')).toBeVisible();
    });
  });
});
