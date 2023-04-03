import { PluginExtensionLinkConfig } from '@grafana/data';

import { deepFreeze, isPluginExtensionLinkConfig, handleErrorsInFn } from './utils';

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

  describe('isPluginExtensionLinkConfig()', () => {
    test('should return TRUE if the object is a command extension config', () => {
      expect(
        isPluginExtensionLinkConfig({
          title: 'Title',
          description: 'Description',
          path: '...',
        } as PluginExtensionLinkConfig)
      ).toBe(true);
    });
    test('should return FALSE if the object is NOT a link extension', () => {
      expect(
        isPluginExtensionLinkConfig({
          title: 'Title',
          description: 'Description',
        } as PluginExtensionLinkConfig)
      ).toBe(false);
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
});
