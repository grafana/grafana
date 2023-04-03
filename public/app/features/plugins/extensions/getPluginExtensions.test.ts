import { PluginExtensionLinkConfig, PluginExtensionTypes } from '@grafana/data';

import { createPluginExtensionRegistry } from './createPluginExtensionRegistry';
import { getPluginExtensions } from './getPluginExtensions';
import { assertPluginExtensionLink } from './validators';

describe('getPluginExtensions()', () => {
  const placement1 = 'grafana/dashboard/panel/menu';
  const placement2 = 'plugins/myorg-basic-app/start';
  const pluginId = 'grafana-basic-app';
  let link1: PluginExtensionLinkConfig, link2: PluginExtensionLinkConfig;

  beforeEach(() => {
    link1 = {
      title: 'Link 1',
      description: 'Link 1 description',
      path: `/a/${pluginId}/declare-incident`,
      placement: placement1,
      configure: jest.fn().mockReturnValue({}),
    };
    link2 = {
      title: 'Link 2',
      description: 'Link 2 description',
      path: `/a/${pluginId}/declare-incident`,
      placement: placement2,
      configure: jest.fn().mockImplementation((context) => ({ title: context?.title })),
    };

    global.console.warn = jest.fn();
  });

  test('should return the extensions for the given placement', () => {
    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link1, link2] }]);
    const { extensions } = getPluginExtensions({ registry, placement: placement1 });

    expect(extensions).toHaveLength(1);
    expect(extensions[0]).toEqual(
      expect.objectContaining({
        pluginId,
        type: PluginExtensionTypes.link,
        title: link1.title,
        description: link1.description,
        path: link1.path,
      })
    );
  });

  test('should return with an empty list if there are no extensions registered for a placement yet', () => {
    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link1, link2] }]);
    const { extensions } = getPluginExtensions({ registry, placement: 'placement-with-no-extensions' });

    expect(extensions).toEqual([]);
  });

  test('should pass the context to the configure() function', () => {
    const context = { title: 'New title from the context!' };
    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link2] }]);

    getPluginExtensions({ registry, context, placement: placement2 });

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(link2.configure).toHaveBeenCalledWith(context);
  });

  test('should be possible to update the basic properties with the configure() function', () => {
    link2.configure = jest.fn().mockImplementation(() => ({
      title: 'Updated title',
      description: 'Updated description',
      path: `/a/${pluginId}/updated-path`,
    }));

    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link2] }]);
    const { extensions } = getPluginExtensions({ registry, placement: placement2 });
    const [extension] = extensions;

    assertPluginExtensionLink(extension);

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(extension.title).toBe('Updated title');
    expect(extension.description).toBe('Updated description');
    expect(extension.path).toBe(`/a/${pluginId}/updated-path`);
  });

  test('should hide the extension if it tries to override not-allowed properties with the configure() function', () => {
    link2.configure = jest.fn().mockImplementation(() => ({
      // The following props are not allowed to override
      type: 'unknown-type',
      pluginId: 'another-plugin',
    }));

    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link2] }]);
    const { extensions } = getPluginExtensions({ registry, placement: placement2 });

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(extensions).toHaveLength(0);
  });
  test('should pass a frozen copy of the context to the configure() function', () => {
    const context = { title: 'New title from the context!' };
    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link2] }]);
    const { extensions } = getPluginExtensions({ registry, context, placement: placement2 });
    const [extension] = extensions;
    const frozenContext = (link2.configure as jest.Mock).mock.calls[0][0];

    assertPluginExtensionLink(extension);

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(Object.isFrozen(frozenContext)).toBe(true);
    expect(() => {
      frozenContext.title = 'New title';
    }).toThrow();
    expect(context.title).toBe('New title from the context!');
  });

  test('should catch errors in the configure() function and log them as warnings', () => {
    link2.configure = jest.fn().mockImplementation(() => {
      throw new Error('Something went wrong!');
    });

    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link2] }]);

    expect(() => {
      getPluginExtensions({ registry, placement: placement2 });
    }).not.toThrow();

    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(global.console.warn).toHaveBeenCalledTimes(1);
    expect(global.console.warn).toHaveBeenCalledWith('[Plugin Extensions] Something went wrong!');
  });

  test('should skip the link extension if the configure() function returns with an invalid path', () => {
    link1.configure = jest.fn().mockImplementation(() => ({
      path: '/a/another-plugin/page-a',
    }));
    link2.configure = jest.fn().mockImplementation(() => ({
      path: 'invalid-path',
    }));

    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link1, link2] }]);
    const { extensions: extensionsAtPlacement1 } = getPluginExtensions({ registry, placement: placement1 });
    const { extensions: extensionsAtPlacement2 } = getPluginExtensions({ registry, placement: placement2 });

    expect(extensionsAtPlacement1).toHaveLength(0);
    expect(extensionsAtPlacement2).toHaveLength(0);

    expect(link1.configure).toHaveBeenCalledTimes(1);
    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(global.console.warn).toHaveBeenCalledTimes(2);
  });

  test('should skip the extension if any of the updated props returned by the configure() function are invalid', () => {
    const overrides = {
      title: '', // Invalid empty string for title - should be ignored
      description: 'A valid description.', // This should be updated
    };

    link2.configure = jest.fn().mockImplementation(() => overrides);

    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link2] }]);
    const { extensions } = getPluginExtensions({ registry, placement: placement2 });

    expect(extensions).toHaveLength(0);
    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(global.console.warn).toHaveBeenCalledTimes(1);
  });

  test('should skip the extension if the configure() function returns a promise', () => {
    link2.configure = jest.fn().mockImplementation(() => Promise.resolve({}));

    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link2] }]);
    const { extensions } = getPluginExtensions({ registry, placement: placement2 });

    expect(extensions).toHaveLength(0);
    expect(link2.configure).toHaveBeenCalledTimes(1);
    expect(global.console.warn).toHaveBeenCalledTimes(1);
  });

  test('should skip (hide) the extension if the configure() function returns undefined', () => {
    link2.configure = jest.fn().mockImplementation(() => undefined);

    const registry = createPluginExtensionRegistry([{ pluginId, extensionConfigs: [link2] }]);
    const { extensions } = getPluginExtensions({ registry, placement: placement2 });

    expect(extensions).toHaveLength(0);
    expect(global.console.warn).toHaveBeenCalledTimes(0); // As this is intentional, no warning should be logged
  });
});
