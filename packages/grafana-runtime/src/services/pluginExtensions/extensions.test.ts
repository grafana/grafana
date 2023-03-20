import { assertPluginExtensionLink, PluginExtensionLink, PluginExtensionTypes } from '@grafana/data';

import { deepFreeze, getPluginExtensions } from './extensions';
import { PluginExtensionRegistryItem, setPluginsExtensionRegistry } from './registry';

describe('getPluginExtensions', () => {
  describe('when getting extensions for placement', () => {
    const placement = 'grafana/dashboard/panel/menu';
    const pluginId = 'grafana-basic-app';

    beforeAll(() => {
      setPluginsExtensionRegistry({
        [placement]: [
          createRegistryLinkItem({
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            path: `/a/${pluginId}/declare-incident`,
            key: 1,
          }),
        ],
        'plugins/myorg-basic-app/start': [
          createRegistryLinkItem({
            title: 'Declare incident',
            description: 'Declaring an incident in the app',
            path: `/a/${pluginId}/declare-incident`,
            key: 2,
          }),
        ],
      });
    });

    it('should return extensions with correct path', () => {
      const { extensions } = getPluginExtensions({ placement });
      const [extension] = extensions;

      assertPluginExtensionLink(extension);

      expect(extension.path).toBe(`/a/${pluginId}/declare-incident`);
      expect(extensions.length).toBe(1);
    });

    it('should return extensions with correct description', () => {
      const { extensions } = getPluginExtensions({ placement });
      const [extension] = extensions;

      assertPluginExtensionLink(extension);

      expect(extension.description).toBe('Declaring an incident in the app');
      expect(extensions.length).toBe(1);
    });

    it('should return extensions with correct title', () => {
      const { extensions } = getPluginExtensions({ placement });
      const [extension] = extensions;

      assertPluginExtensionLink(extension);

      expect(extension.title).toBe('Declare incident');
      expect(extensions.length).toBe(1);
    });

    it('should return an empty array when extensions can be found', () => {
      const { extensions } = getPluginExtensions({
        placement: 'plugins/not-installed-app/news',
      });

      expect(extensions.length).toBe(0);
    });
  });
});

describe('deepFreeze()', () => {
  test('should not fail when called with primitive values', () => {
    expect(deepFreeze<Number>(1)).toBe(1);
    expect(deepFreeze<String>('foo')).toBe('foo');
    expect(deepFreeze<Boolean>(true)).toBe(true);
    expect(deepFreeze<Boolean>(false)).toBe(false);

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
    const frozen = deepFreeze<typeof obj>(obj);

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
    const frozen = deepFreeze<typeof obj>(obj);

    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() => {
      frozen.a = 2;
      frozen.b = '3';
      frozen.c = false;
    }).toThrow(TypeError);
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
    const frozen = deepFreeze<typeof obj>(obj);

    // Check if the object is frozen
    expect(Object.isFrozen(frozen)).toBe(true);

    // Trying to override a primitive property
    expect(() => {
      frozen.a = 2;
    }).toThrow(TypeError);

    // Trying to override an underlying object and check if it is frozen
    expect(Object.isFrozen(frozen.b)).toBe(true);
    expect(() => {
      // @ts-ignore
      frozen.b = {};
    }).toThrow(TypeError);

    // Trying to override deeply nested properties
    expect(() => {
      frozen.b.c.e.f = 12345;
    }).toThrow(TypeError);
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
      frozen = deepFreeze<typeof obj>(obj);
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

function createRegistryLinkItem(
  link: Omit<PluginExtensionLink, 'type'>
): PluginExtensionRegistryItem<PluginExtensionLink> {
  return (context?: object) => ({
    ...link,
    type: PluginExtensionTypes.link,
  });
}
