import { memo } from 'react';

import {
  PluginContextType,
  PluginExtensionAddedLinkConfig,
  PluginExtensionPoints,
  PluginLoadingStrategy,
  PluginType,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { createLogMock } from './logs/testUtils';
import {
  assertConfigureIsValid,
  assertLinkPathIsValid,
  assertStringProps,
  isAddedComponentMetaInfoMissing,
  isAddedLinkMetaInfoMissing,
  isExposedComponentDependencyMissing,
  isExposedComponentMetaInfoMissing,
  isExtensionPointIdValid,
  isExtensionPointMetaInfoMissing,
  isGrafanaCoreExtensionPoint,
  isReactComponent,
} from './validators';

describe('Plugin Extension Validators', () => {
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

  describe('assertConfigureIsValid()', () => {
    it('should NOT throw an error if the configure() function is missing', () => {
      expect(() => {
        assertConfigureIsValid({
          title: 'Title',
          description: 'Description',
          targets: 'grafana/some-page/extension-point-a',
        } as PluginExtensionAddedLinkConfig);
      }).not.toThrowError();
    });

    it('should NOT throw an error if the configure() function is a valid function', () => {
      expect(() => {
        assertConfigureIsValid({
          title: 'Title',
          description: 'Description',
          targets: 'grafana/some-page/extension-point-a',
          configure: () => {},
        } as PluginExtensionAddedLinkConfig);
      }).not.toThrowError();
    });

    it('should throw an error if the configure() function is defined but is not a function', () => {
      expect(() => {
        assertConfigureIsValid({
          title: 'Title',
          description: 'Description',
          extensionPointId: 'grafana/some-page/extension-point-a',
          handler: () => {},
          configure: '() => {}',
        } as unknown as PluginExtensionAddedLinkConfig); // We are casting to unknown to test it with a unvalid argument
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

  describe('isReactComponent()', () => {
    it('should return TRUE if we pass in a valid React component', () => {
      expect(isReactComponent(() => <div>Some text</div>)).toBe(true);
    });

    it('should return TRUE if we pass in a component wrapped with React.memo()', () => {
      const Component = () => <div>Some text</div>;
      const wrapped = memo(() => (
        <div>
          <Component />
        </div>
      ));
      wrapped.displayName = 'MyComponent';

      expect(isReactComponent(wrapped)).toBe(true);
    });

    it('should return FALSE if we pass in a valid React component', () => {
      expect(isReactComponent('Foo bar')).toBe(false);
      expect(isReactComponent(123)).toBe(false);
      expect(isReactComponent(false)).toBe(false);
      expect(isReactComponent(undefined)).toBe(false);
      expect(isReactComponent(null)).toBe(false);
    });
  });

  describe('isGrafanaCoreExtensionPoint()', () => {
    it('should return TRUE if we pass an PluginExtensionPoints value', () => {
      expect(isGrafanaCoreExtensionPoint(PluginExtensionPoints.AlertingAlertingRuleAction)).toBe(true);
    });

    it('should return TRUE if we pass a string that is not listed under the PluginExtensionPoints enum', () => {
      expect(isGrafanaCoreExtensionPoint('grafana/alerting/alertingrule/action')).toBe(true);
    });

    it('should return FALSE if we pass a string that is not listed under the PluginExtensionPoints enum', () => {
      expect(isGrafanaCoreExtensionPoint('grafana/dashboard/alertingrule/action')).toBe(false);
    });
  });

  describe('isExtensionPointIdValid()', () => {
    test.each([
      [PluginExtensionPoints.DashboardPanelMenu, ''],
      [PluginExtensionPoints.DashboardPanelMenu, 'grafana'],
      ['myorg-extensions-app/extension-point', 'myorg-extensions-app'],
      ['myorg-extensions-app/extension-point/v1', 'myorg-extensions-app'],
      ['plugins/myorg-extensions-app/extension-point/v1', 'myorg-extensions-app'],
      ['plugins/myorg-basic-app/start', 'myorg-basic-app'],
      ['myorg-extensions-app/extension-point/v1', 'myorg-extensions-app'],
      ['plugins/myorg-extensions-app/extension-point/v1', 'myorg-extensions-app'],
      ['plugins/grafana-app-observability-app/service/action', 'grafana-app-observability-app'],
      ['plugins/grafana-k8s-app/cluster/action', 'grafana-k8s-app'],
      ['plugins/grafana-oncall-app/alert-group/action', 'grafana-oncall-app'],
      ['plugins/grafana-oncall-app/alert-group/action/v1', 'grafana-oncall-app'],
      ['plugins/grafana-oncall-app/alert-group/action/v1.0.0', 'grafana-oncall-app'],
    ])('should return TRUE if the extension point id is valid ("%s", "%s")', (extensionPointId, pluginId) => {
      expect(
        isExtensionPointIdValid({
          extensionPointId,
          pluginId,
          isInsidePlugin: pluginId !== 'grafana' && pluginId !== '',
          isCoreGrafanaPlugin: false,
          log: createLogMock(),
        })
      ).toBe(true);
    });

    test.each([
      [
        // Plugin id mismatch
        'myorg-extensions-app/extension-point/v1',
        'myorgs-other-app',
      ],
      [
        // Missing plugin id prefix
        'extension-point/v1',
        'myorgs-extensions-app',
      ],
    ])('should return FALSE if the extension point id is invalid ("%s", "%s")', (extensionPointId, pluginId) => {
      expect(
        isExtensionPointIdValid({
          extensionPointId,
          pluginId,
          isInsidePlugin: pluginId !== 'grafana' && pluginId !== '',
          isCoreGrafanaPlugin: false,
          log: createLogMock(),
        })
      ).toBe(false);
    });

    it('should return FALSE true if the extension point id is set by a core plugin', () => {
      expect(
        isExtensionPointIdValid({
          extensionPointId: 'traces',
          pluginId: 'traces',
          isInsidePlugin: true,
          isCoreGrafanaPlugin: true,
          log: createLogMock(),
        })
      ).toBe(true);
    });
  });

  describe('isAddedLinkMetaInfoMissing()', () => {
    const originalApps = config.apps;
    const pluginId = 'myorg-extensions-app';
    const appPluginConfig = {
      id: pluginId,
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
    const extensionConfig = {
      targets: [PluginExtensionPoints.DashboardPanelMenu],
      title: 'Link title',
      description: 'Link description',
    };

    beforeEach(() => {
      config.apps = {
        [pluginId]: appPluginConfig,
      };
    });

    afterEach(() => {
      config.apps = originalApps;
    });

    it('should return FALSE if the meta-info in the plugin.json is correct', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.addedLinks.push(extensionConfig);

      const returnValue = isAddedLinkMetaInfoMissing(pluginId, extensionConfig, log);

      expect(returnValue).toBe(false);
      expect(log.error).toHaveBeenCalledTimes(0);
    });

    it('should return TRUE and log an error if the app config is not found', () => {
      const log = createLogMock();
      delete config.apps[pluginId];

      const returnValue = isAddedLinkMetaInfoMissing(pluginId, extensionConfig, log);

      expect(returnValue).toBe(true);
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.error).mock.calls[0][0]).toMatch('The app plugin with plugin id');
    });

    it('should return TRUE and log an error if the link has no meta-info in the plugin.json', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.addedLinks = [];

      const returnValue = isAddedLinkMetaInfoMissing(pluginId, extensionConfig, log);

      expect(returnValue).toBe(true);
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.error).mock.calls[0][0]).toMatch(
        'The extension was not recorded in the plugin.json. Added link extensions must be listed in the section "extensions.addedLinks[]"'
      );
    });

    it('should return TRUE and log an error if the "targets" do not match', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.addedLinks.push(extensionConfig);

      const returnValue = isAddedLinkMetaInfoMissing(
        pluginId,
        {
          ...extensionConfig,
          targets: [PluginExtensionPoints.DashboardPanelMenu, PluginExtensionPoints.ExploreToolbarAction],
        },
        log
      );

      expect(returnValue).toBe(true);
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.error).mock.calls[0][0]).toMatch(
        'The "targets" for the registered extension does not match'
      );
    });

    it('should return FALSE and log a warning if the "description" does not match', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.addedLinks.push(extensionConfig);

      const returnValue = isAddedLinkMetaInfoMissing(
        pluginId,
        {
          ...extensionConfig,
          description: 'Link description UPDATED',
        },
        log
      );

      expect(returnValue).toBe(false);
      expect(log.warning).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.warning).mock.calls[0][0]).toMatch('"description" doesn\'t match');
    });

    it('should return FALSE with links with the same title but different targets', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.addedLinks.push(extensionConfig);
      const extensionConfig2 = {
        ...extensionConfig,
        targets: [PluginExtensionPoints.ExploreToolbarAction],
      };
      config.apps[pluginId].extensions.addedLinks.push(extensionConfig2);

      const returnValue = isAddedLinkMetaInfoMissing(pluginId, extensionConfig2, log);

      expect(returnValue).toBe(false);
      expect(log.error).toHaveBeenCalledTimes(0);
    });
  });

  describe('isAddedComponentMetaInfoMissing()', () => {
    const originalApps = config.apps;
    const pluginId = 'myorg-extensions-app';
    const appPluginConfig = {
      id: pluginId,
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
    const extensionConfig = {
      targets: [PluginExtensionPoints.DashboardPanelMenu],
      title: 'Component title',
      description: 'Component description',
      component: () => <div>Component content</div>,
    };

    beforeEach(() => {
      config.apps = {
        [pluginId]: appPluginConfig,
      };
    });

    afterEach(() => {
      config.apps = originalApps;
    });

    it('should return FALSE if the meta-info in the plugin.json is correct', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.addedComponents.push(extensionConfig);

      const returnValue = isAddedComponentMetaInfoMissing(pluginId, extensionConfig, log);

      expect(returnValue).toBe(false);
      expect(log.error).toHaveBeenCalledTimes(0);
    });

    it('should return TRUE and log an error if the app config is not found', () => {
      const log = createLogMock();
      delete config.apps[pluginId];

      const returnValue = isAddedComponentMetaInfoMissing(pluginId, extensionConfig, log);

      expect(returnValue).toBe(true);
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.error).mock.calls[0][0]).toMatch('The app plugin with plugin id');
    });

    it('should return TRUE and log an error if the Component has no meta-info in the plugin.json', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.addedComponents = [];

      const returnValue = isAddedComponentMetaInfoMissing(pluginId, extensionConfig, log);

      expect(returnValue).toBe(true);
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.error).mock.calls[0][0]).toMatch(
        'The extension was not recorded in the plugin.json. Added component extensions must be listed in the section "extensions.addedComponents[]"'
      );
    });

    it('should return TRUE and log an error if the "targets" do not match', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.addedComponents.push(extensionConfig);

      const returnValue = isAddedComponentMetaInfoMissing(
        pluginId,
        {
          ...extensionConfig,
          targets: [PluginExtensionPoints.ExploreToolbarAction],
        },
        log
      );

      expect(returnValue).toBe(true);
      expect(jest.mocked(log.error).mock.calls[0][0]).toMatch(
        'The "targets" for the registered extension does not match'
      );
    });

    it('should return FALSE and log a warning if the "description" does not match', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.addedComponents.push(extensionConfig);

      const returnValue = isAddedComponentMetaInfoMissing(
        pluginId,
        {
          ...extensionConfig,
          description: 'UPDATED',
        },
        log
      );

      expect(returnValue).toBe(false);
      expect(log.warning).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.warning).mock.calls[0][0]).toMatch('"description" doesn\'t match');
    });

    it('should return FALSE with components with the same title but different targets', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.addedComponents.push(extensionConfig);
      const extensionConfig2 = {
        ...extensionConfig,
        targets: [PluginExtensionPoints.ExploreToolbarAction],
      };
      config.apps[pluginId].extensions.addedComponents.push(extensionConfig2);

      const returnValue = isAddedComponentMetaInfoMissing(pluginId, extensionConfig2, log);

      expect(returnValue).toBe(false);
      expect(log.error).toHaveBeenCalledTimes(0);
    });
  });

  describe('isExposedComponentMetaInfoMissing()', () => {
    const originalApps = config.apps;
    const pluginId = 'myorg-extensions-app';
    const appPluginConfig = {
      id: pluginId,
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
    const exposedComponentConfig = {
      id: `${pluginId}/component/v1`,
      title: 'Exposed component',
      description: 'Exposed component description',
      component: () => <div>Component content</div>,
    };

    beforeEach(() => {
      config.apps = {
        [pluginId]: appPluginConfig,
      };
    });

    afterEach(() => {
      config.apps = originalApps;
    });

    it('should return FALSE if the meta-info in the plugin.json is correct', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.exposedComponents.push(exposedComponentConfig);

      const returnValue = isExposedComponentMetaInfoMissing(pluginId, exposedComponentConfig, log);

      expect(returnValue).toBe(false);
      expect(log.warning).toHaveBeenCalledTimes(0);
    });

    it('should return TRUE and log an error if the app config is not found', () => {
      const log = createLogMock();
      delete config.apps[pluginId];

      const returnValue = isExposedComponentMetaInfoMissing(pluginId, exposedComponentConfig, log);

      expect(returnValue).toBe(true);
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.error).mock.calls[0][0]).toMatch('The app plugin with plugin id');
    });

    it('should return TRUE and log an error if the exposed component has no meta-info in the plugin.json', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.exposedComponents = [];

      const returnValue = isExposedComponentMetaInfoMissing(pluginId, exposedComponentConfig, log);

      expect(returnValue).toBe(true);
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.error).mock.calls[0][0]).toMatch(
        'The exposed component was not recorded in the plugin.json. Exposed component extensions must be listed in the section "extensions.exposedComponents[]"'
      );
    });

    it('should return TRUE and log an error if the title does not match', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.exposedComponents.push(exposedComponentConfig);

      const returnValue = isExposedComponentMetaInfoMissing(
        pluginId,
        {
          ...exposedComponentConfig,
          title: 'UPDATED',
        },
        log
      );

      expect(returnValue).toBe(true);
      expect(log.error).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.error).mock.calls[0][0]).toMatch(
        'The "title" doesn\'t match the title recorded in plugin.json.'
      );
    });

    it('should return FALSE and log a warning if the "description" does not match', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.exposedComponents.push(exposedComponentConfig);

      const returnValue = isExposedComponentMetaInfoMissing(
        pluginId,
        {
          ...exposedComponentConfig,
          description: 'UPDATED',
        },
        log
      );

      expect(returnValue).toBe(false);
      expect(log.warning).toHaveBeenCalledTimes(1);
      expect(jest.mocked(log.warning).mock.calls[0][0]).toMatch('"description" doesn\'t match');
    });

    it('should return FALSE with components with the same title but different targets', () => {
      const log = createLogMock();
      config.apps[pluginId].extensions.exposedComponents.push(exposedComponentConfig);
      const exposedComponentConfig2 = {
        ...exposedComponentConfig,
        targets: [PluginExtensionPoints.ExploreToolbarAction],
      };
      config.apps[pluginId].extensions.exposedComponents.push(exposedComponentConfig2);

      const returnValue = isExposedComponentMetaInfoMissing(pluginId, exposedComponentConfig2, log);

      expect(returnValue).toBe(false);
      expect(log.error).toHaveBeenCalledTimes(0);
    });
  });

  describe('isExposedComponentDependencyMissing()', () => {
    let pluginContext: PluginContextType;
    const pluginId = 'myorg-extensions-app';
    const exposedComponentId = `${pluginId}/component/v1`;

    beforeEach(() => {
      pluginContext = {
        meta: {
          id: pluginId,
          name: 'Extensions App',
          type: PluginType.app,
          module: '',
          baseUrl: '',
          info: {
            author: {
              name: 'MyOrg',
            },
            description: 'App for testing extensions',
            links: [],
            logos: {
              large: '',
              small: '',
            },
            screenshots: [],
            updated: '2023-10-26T18:25:01Z',
            version: '1.0.0',
          },
          dependencies: {
            grafanaVersion: '8.0.0',
            plugins: [],
            extensions: {
              exposedComponents: [],
            },
          },
        },
      };
    });

    it('should return FALSE if the meta-info in the plugin.json is correct', () => {
      pluginContext.meta.dependencies?.extensions.exposedComponents.push(exposedComponentId);
      const returnValue = isExposedComponentDependencyMissing(exposedComponentId, pluginContext);
      expect(returnValue).toBe(false);
    });

    it('should return TRUE if the dependencies are missing', () => {
      delete pluginContext.meta.dependencies;
      const returnValue = isExposedComponentDependencyMissing(exposedComponentId, pluginContext);
      expect(returnValue).toBe(true);
    });

    it('should return TRUE if the exposed component id is not specified in the list of dependencies', () => {
      const returnValue = isExposedComponentDependencyMissing(exposedComponentId, pluginContext);
      expect(returnValue).toBe(true);
    });
  });

  describe('isExtensionPointMetaInfoMissing()', () => {
    let pluginContext: PluginContextType;
    const pluginId = 'myorg-extensions-app';
    const extensionPointId = `${pluginId}/extension-point/v1`;
    const extensionPointConfig = {
      id: extensionPointId,
      title: 'Extension point title',
      description: 'Extension point description',
    };

    beforeEach(() => {
      pluginContext = {
        meta: {
          id: pluginId,
          name: 'Extensions App',
          type: PluginType.app,
          module: '',
          baseUrl: '',
          info: {
            author: {
              name: 'MyOrg',
            },
            description: 'App for testing extensions',
            links: [],
            logos: {
              large: '',
              small: '',
            },
            screenshots: [],
            updated: '2023-10-26T18:25:01Z',
            version: '1.0.0',
          },
          extensions: {
            addedLinks: [],
            addedComponents: [],
            exposedComponents: [],
            extensionPoints: [],
            addedFunctions: [],
          },
          dependencies: {
            grafanaVersion: '8.0.0',
            plugins: [],
            extensions: {
              exposedComponents: [],
            },
          },
        },
      };
    });

    it('should return FALSE if the meta-info in the plugin.json is correct', () => {
      pluginContext.meta.extensions?.extensionPoints.push(extensionPointConfig);

      const returnValue = isExtensionPointMetaInfoMissing(extensionPointId, pluginContext);

      expect(returnValue).toBe(false);
    });

    it('should return TRUE if the extension point id is not recorded in the plugin.json', () => {
      const returnValue = isExtensionPointMetaInfoMissing(extensionPointId, pluginContext);
      expect(returnValue).toBe(true);
    });
  });
});
