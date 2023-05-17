import { PluginExtension, PluginExtensionLinkConfig, PluginExtensionTypes } from '@grafana/data';

import {
  assertConfigureIsValid,
  assertLinkPathIsValid,
  assertExtensionPointIdIsValid,
  assertPluginExtensionLink,
  assertStringProps,
  isPluginExtensionConfigValid,
} from './validators';

describe('Plugin Extension Validators', () => {
  describe('assertPluginExtensionLink()', () => {
    it('should NOT throw an error if it is a link extension', () => {
      expect(() => {
        assertPluginExtensionLink({
          id: 'id',
          pluginId: 'myorg-b-app',
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          path: '...',
        } as PluginExtension);
      }).not.toThrowError();
    });

    it('should throw an error if it is not a link extension', () => {
      expect(() => {
        assertPluginExtensionLink({
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
        } as PluginExtension);
      }).toThrowError();
    });
  });

  describe('assertLinkPathIsValid()', () => {
    it('should not throw an error if the link path is valid', () => {
      expect(() => {
        const pluginId = 'myorg-b-app';
        const extension = {
          path: `/a/${pluginId}/overview`,
          title: 'My Plugin',
          description: 'My Plugin Description',
          extensionPointId: '...',
        };

        assertLinkPathIsValid(pluginId, extension.path);
      }).not.toThrowError();
    });

    it('should throw an error if the link path is pointing to a different plugin', () => {
      expect(() => {
        const extension = {
          path: `/a/myorg-b-app/overview`,
          title: 'My Plugin',
          description: 'My Plugin Description',
          extensionPointId: '...',
        };

        assertLinkPathIsValid('another-plugin-app', extension.path);
      }).toThrowError();
    });

    it('should throw an error if the link path is not prefixed with "/a/<PLUGIN_ID>"', () => {
      expect(() => {
        const extension = {
          path: `/some-bad-path`,
          title: 'My Plugin',
          description: 'My Plugin Description',
          extensionPointId: '...',
        };

        assertLinkPathIsValid('myorg-b-app', extension.path);
      }).toThrowError();
    });
  });

  describe('assertExtensionPointIdIsValid()', () => {
    it('should throw an error if the extensionPointId does not have the right prefix', () => {
      expect(() => {
        assertExtensionPointIdIsValid({
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          extensionPointId: 'wrong-extension-point-id',
        });
      }).toThrowError();
    });

    it('should NOT throw an error if the extensionPointId is correct', () => {
      expect(() => {
        assertExtensionPointIdIsValid({
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          extensionPointId: 'grafana/some-page/extension-point-a',
        });

        assertExtensionPointIdIsValid({
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          extensionPointId: 'plugins/my-super-plugin/some-page/extension-point-a',
        });
      }).not.toThrowError();
    });
  });

  describe('assertConfigureIsValid()', () => {
    it('should NOT throw an error if the configure() function is missing', () => {
      expect(() => {
        assertConfigureIsValid({
          title: 'Title',
          description: 'Description',
          extensionPointId: 'grafana/some-page/extension-point-a',
        } as PluginExtensionLinkConfig);
      }).not.toThrowError();
    });

    it('should NOT throw an error if the configure() function is a valid function', () => {
      expect(() => {
        assertConfigureIsValid({
          title: 'Title',
          description: 'Description',
          extensionPointId: 'grafana/some-page/extension-point-a',
          configure: () => {},
        } as PluginExtensionLinkConfig);
      }).not.toThrowError();
    });

    it('should throw an error if the configure() function is defined but is not a function', () => {
      expect(() => {
        assertConfigureIsValid(
          // @ts-ignore
          {
            title: 'Title',
            description: 'Description',
            extensionPointId: 'grafana/some-page/extension-point-a',
            handler: () => {},
            configure: '() => {}',
          } as PluginExtensionLinkConfig
        );
      }).toThrowError();
    });
  });

  describe('assertStringProps()', () => {
    it('should throw an error if any of the expected string properties is missing', () => {
      expect(() => {
        assertStringProps(
          {
            description: 'Description',
            extensionPointId: 'grafana/some-page/extension-point-a',
          },
          ['title', 'description', 'extensionPointId']
        );
      }).toThrowError();
    });

    it('should throw an error if any of the expected string properties is an empty string', () => {
      expect(() => {
        assertStringProps(
          {
            title: '',
            description: 'Description',
            extensionPointId: 'grafana/some-page/extension-point-a',
          },
          ['title', 'description', 'extensionPointId']
        );
      }).toThrowError();
    });

    it('should NOT throw an error if the expected string props are present and not empty', () => {
      expect(() => {
        assertStringProps(
          {
            title: 'Title',
            description: 'Description',
            extensionPointId: 'grafana/some-page/extension-point-a',
          },
          ['title', 'description', 'extensionPointId']
        );
      }).not.toThrowError();
    });

    it('should NOT throw an error if there are other existing and empty string properties, that we did not specify', () => {
      expect(() => {
        assertStringProps(
          {
            title: 'Title',
            description: 'Description',
            extensionPointId: 'grafana/some-page/extension-point-a',
            dontCare: '',
          },
          ['title', 'description', 'extensionPointId']
        );
      }).not.toThrowError();
    });
  });

  describe('isPluginExtensionConfigValid()', () => {
    it('should return TRUE if the plugin extension configuration is valid', () => {
      const pluginId = 'my-super-plugin';

      expect(
        isPluginExtensionConfigValid(pluginId, {
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          onClick: jest.fn(),
          extensionPointId: 'grafana/some-page/extension-point-a',
        } as PluginExtensionLinkConfig)
      ).toBe(true);

      expect(
        isPluginExtensionConfigValid(pluginId, {
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          extensionPointId: 'grafana/some-page/extension-point-a',
          path: `/a/${pluginId}/page`,
        } as PluginExtensionLinkConfig)
      ).toBe(true);
    });

    it('should return FALSE if the plugin extension configuration is invalid', () => {
      const pluginId = 'my-super-plugin';

      global.console.warn = jest.fn();

      // Link (wrong path)
      expect(
        isPluginExtensionConfigValid(pluginId, {
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          extensionPointId: 'grafana/some-page/extension-point-a',
          path: '/administration/users',
        } as PluginExtensionLinkConfig)
      ).toBe(false);

      // Link (no path and no onClick)
      expect(
        isPluginExtensionConfigValid(pluginId, {
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          extensionPointId: 'grafana/some-page/extension-point-a',
        } as PluginExtensionLinkConfig)
      ).toBe(false);

      // Link (missing title)
      expect(
        isPluginExtensionConfigValid(pluginId, {
          type: PluginExtensionTypes.link,
          title: '',
          description: 'Description',
          extensionPointId: 'grafana/some-page/extension-point-a',
          path: `/a/${pluginId}/page`,
        } as PluginExtensionLinkConfig)
      ).toBe(false);
    });
  });
});
