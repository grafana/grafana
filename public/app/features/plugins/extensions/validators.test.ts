import { PluginExtension, PluginExtensionLinkConfig, PluginExtensionTypes } from '@grafana/data';

import {
  assertConfigureIsValid,
  assertLinkPathIsValid,
  assertPlacementIsValid,
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
          placement: '...',
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
          placement: '...',
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
          placement: '...',
        };

        assertLinkPathIsValid('myorg-b-app', extension.path);
      }).toThrowError();
    });
  });

  describe('assertPlacementIsValid()', () => {
    it('should throw an error if the placement does not have the right prefix', () => {
      expect(() => {
        assertPlacementIsValid({
          title: 'Title',
          description: 'Description',
          path: '...',
          placement: 'some-bad-placement',
        });
      }).toThrowError();
    });

    it('should NOT throw an error if the placement is correct', () => {
      expect(() => {
        assertPlacementIsValid({
          title: 'Title',
          description: 'Description',
          path: '...',
          placement: 'grafana/some-page/some-placement',
        });

        assertPlacementIsValid({
          title: 'Title',
          description: 'Description',
          path: '...',
          placement: 'plugins/my-super-plugin/some-page/some-placement',
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
          placement: 'grafana/some-page/some-placement',
        } as PluginExtensionLinkConfig);
      }).not.toThrowError();
    });

    it('should NOT throw an error if the configure() function is a valid function', () => {
      expect(() => {
        assertConfigureIsValid({
          title: 'Title',
          description: 'Description',
          placement: 'grafana/some-page/some-placement',
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
            placement: 'grafana/some-page/some-placement',
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
            placement: 'grafana/some-page/some-placement',
          },
          ['title', 'description', 'placement']
        );
      }).toThrowError();
    });

    it('should throw an error if any of the expected string properties is an empty string', () => {
      expect(() => {
        assertStringProps(
          {
            title: '',
            description: 'Description',
            placement: 'grafana/some-page/some-placement',
          },
          ['title', 'description', 'placement']
        );
      }).toThrowError();
    });

    it('should NOT throw an error if the expected string props are present and not empty', () => {
      expect(() => {
        assertStringProps(
          {
            title: 'Title',
            description: 'Description',
            placement: 'grafana/some-page/some-placement',
          },
          ['title', 'description', 'placement']
        );
      }).not.toThrowError();
    });

    it('should NOT throw an error if there are other existing and empty string properties, that we did not specify', () => {
      expect(() => {
        assertStringProps(
          {
            title: 'Title',
            description: 'Description',
            placement: 'grafana/some-page/some-placement',
            dontCare: '',
          },
          ['title', 'description', 'placement']
        );
      }).not.toThrowError();
    });
  });

  describe('isPluginExtensionConfigValid()', () => {
    it('should return TRUE if the plugin extension configuration is valid', () => {
      const pluginId = 'my-super-plugin';
      // Command
      expect(
        isPluginExtensionConfigValid(pluginId, {
          title: 'Title',
          description: 'Description',
          placement: 'grafana/some-page/some-placement',
        } as PluginExtensionLinkConfig)
      ).toBe(true);

      // Link
      expect(
        isPluginExtensionConfigValid(pluginId, {
          title: 'Title',
          description: 'Description',
          placement: 'grafana/some-page/some-placement',
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
          title: 'Title',
          description: 'Description',
          placement: 'grafana/some-page/some-placement',
          path: '/administration/users',
        } as PluginExtensionLinkConfig)
      ).toBe(false);

      // Link (missing title)
      expect(
        isPluginExtensionConfigValid(pluginId, {
          title: '',
          description: 'Description',
          placement: 'grafana/some-page/some-placement',
          path: `/a/${pluginId}/page`,
        } as PluginExtensionLinkConfig)
      ).toBe(false);
    });
  });
});
