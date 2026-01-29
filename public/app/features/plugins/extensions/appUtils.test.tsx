// The tests here are mostly a copy of the tests in public/app/features/plugins/extensions/utils.tsx + real config.apps tests

import { type AppPluginConfig, PluginExtensionPoints, PluginLoadingStrategy } from '@grafana/data';

import {
  getAppPluginConfigsSync,
  getAppPluginDependenciesSync,
  getAppPluginIdFromExposedComponentId,
  getExposedComponentPluginDependenciesSync,
  getExtensionPointPluginDependenciesSync,
  getExtensionPointPluginMetaSync,
} from './appUtils';
import { apps, genericAppPluginConfig, metas } from './test-fixtures/config.apps';

describe('getAppPluginConfigsSync', () => {
  test('should return the app plugin configs based on the provided plugin ids', () => {
    const appPluginIds = getAppPluginConfigsSync(['myorg-someplugin-app', 'grafana-exploretraces-app'], apps);

    expect(appPluginIds).toEqual([metas['grafana-exploretraces-app'], metas['myorg-someplugin-app']]);
  });

  test('should simply ignore the app plugin ids that do not belong to a config', () => {
    const appPluginIds = getAppPluginConfigsSync(['myorg-someplugin-app', 'unknown-app-id'], apps);

    expect(appPluginIds).toEqual([metas['myorg-someplugin-app']]);
  });
});

describe('getAppPluginIdFromExposedComponentId', () => {
  test('should return the app plugin id from an extension point id', () => {
    expect(getAppPluginIdFromExposedComponentId('myorg-extensions-app/component/v1')).toBe('myorg-extensions-app');
  });
});

describe('getExtensionPointPluginDependenciesSync', () => {
  test('should return the app plugin ids that register extensions to a link extension point', () => {
    const extensionPointId = 'myorg-first-app/link/v1';

    const apps = Object.values({
      'myorg-first-app': {
        ...genericAppPluginConfig,
        id: 'myorg-first-app',
      },
      // This plugin is registering a link extension to the extension point
      'myorg-second-app': {
        ...genericAppPluginConfig,
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
        ...genericAppPluginConfig,
        id: 'myorg-third-app',
      },
    });

    const appPluginIds = getExtensionPointPluginDependenciesSync(extensionPointId, apps);

    expect(appPluginIds).toEqual(['myorg-second-app']);
  });

  test('should return the app plugin ids that register extensions to a component extension point', () => {
    const extensionPointId = 'myorg-first-app/component/v1';

    const apps = Object.values({
      'myorg-first-app': {
        ...genericAppPluginConfig,
        id: 'myorg-first-app',
      },
      'myorg-second-app': {
        ...genericAppPluginConfig,
        id: 'myorg-second-app',
      },
      // This plugin is registering a component extension to the extension point
      'myorg-third-app': {
        ...genericAppPluginConfig,
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
    });

    const appPluginIds = getExtensionPointPluginDependenciesSync(extensionPointId, apps);

    expect(appPluginIds).toEqual(['myorg-third-app']);
  });

  test('should return an empty array if there are no apps that that extend the extension point', () => {
    const extensionPointId = 'myorg-first-app/component/v1';

    // None of the apps are extending the extension point
    const apps = Object.values({
      'myorg-first-app': {
        ...genericAppPluginConfig,
        id: 'myorg-first-app',
      },
      'myorg-second-app': {
        ...genericAppPluginConfig,
        id: 'myorg-second-app',
      },
      'myorg-third-app': {
        ...genericAppPluginConfig,
        id: 'myorg-third-app',
      },
    });

    const appPluginIds = getExtensionPointPluginDependenciesSync(extensionPointId, apps);

    expect(appPluginIds).toEqual([]);
  });

  test('should also return (recursively) the app plugin ids that the apps which extend the extension-point depend on', () => {
    const extensionPointId = 'myorg-first-app/component/v1';

    const apps = Object.values({
      'myorg-first-app': {
        ...genericAppPluginConfig,
        id: 'myorg-first-app',
      },
      // This plugin is registering a component extension to the extension point.
      // It is also depending on the 'myorg-fourth-app' plugin.
      'myorg-second-app': {
        ...genericAppPluginConfig,
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
          ...genericAppPluginConfig.dependencies,
          extensions: {
            exposedComponents: ['myorg-fourth-app/component/v1'],
          },
        },
      },
      'myorg-third-app': {
        ...genericAppPluginConfig,
        id: 'myorg-third-app',
      },
      // This plugin exposes a component, but is also depending on the 'myorg-fifth-app'.
      'myorg-fourth-app': {
        ...genericAppPluginConfig,
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
          ...genericAppPluginConfig.dependencies,
          extensions: {
            exposedComponents: ['myorg-fifth-app/component/v1'],
          },
        },
      },
      'myorg-fifth-app': {
        ...genericAppPluginConfig,
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
        ...genericAppPluginConfig,
        id: 'myorg-sixth-app',
      },
    });

    const appPluginIds = getExtensionPointPluginDependenciesSync(extensionPointId, apps);

    expect(appPluginIds).toEqual(['myorg-second-app', 'myorg-fourth-app', 'myorg-fifth-app']);
  });

  test('should return (recursively) the app plugin ids that register extensions to a link extension point', () => {
    const extensionPointId = PluginExtensionPoints.DashboardPanelMenu;

    const appPluginIds = getExtensionPointPluginDependenciesSync(extensionPointId, apps);

    expect(appPluginIds).toEqual([
      'grafana-exploretraces-app',
      'grafana-asserts-app',
      'grafana-asserts-app',
      'grafana-lokiexplore-app',
      'grafana-adaptivelogs-app',
      'grafana-asserts-app',
      'grafana',
      'grafana-metricsdrilldown-app',
      'grafana',
      'grafana-assistant-app',
      'grafana-exploretraces-app',
      'grafana-metricsdrilldown-app',
      'grafana-asserts-app',
      'grafana-asserts-app',
      'grafana',
    ]);
  });

  test('should return (recursively) the app plugin ids that register extensions to a component extension point', () => {
    const extensionPointId = 'grafana-asserts-app/insights-timeline-widget/v1';

    const appPluginIds = getExtensionPointPluginDependenciesSync(extensionPointId, apps);

    expect(appPluginIds).toEqual([
      'grafana-exploretraces-app',
      'grafana-asserts-app',
      'grafana-asserts-app',
      'grafana-lokiexplore-app',
      'grafana-adaptivelogs-app',
      'grafana-asserts-app',
      'grafana',
    ]);
  });

  test('should not return (recursively) the app plugin ids that register extensions to a function extension point', () => {
    const extensionPointId = 'grafana-exploretraces-app/get-logs-drilldown-link/v1';

    const appPluginIds = getExtensionPointPluginDependenciesSync(extensionPointId, apps);

    expect(appPluginIds).toEqual([]);
  });

  test('should return an empty array if there are no apps that that extend the extension point', () => {
    const extensionPointId = PluginExtensionPoints.AlertingHomePage;

    const appPluginIds = getExtensionPointPluginDependenciesSync(extensionPointId, apps);

    expect(appPluginIds).toEqual([]);
  });
});

describe('getExposedComponentPluginDependenciesSync', () => {
  test('should only return the app plugin id that exposes the component, if that component does not depend on anything', () => {
    const exposedComponentId = 'myorg-second-app/component/v1';

    const apps = Object.values({
      'myorg-first-app': {
        ...genericAppPluginConfig,
        id: 'myorg-first-app',
      },
      'myorg-second-app': {
        ...genericAppPluginConfig,
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
        ...genericAppPluginConfig,
        id: 'myorg-third-app',
      },
    });

    const appPluginIds = getExposedComponentPluginDependenciesSync(exposedComponentId, apps);

    expect(appPluginIds).toEqual(['myorg-second-app']);
  });

  test('should also return the list of app plugin ids that the plugin - which exposes the component - is depending on', () => {
    const exposedComponentId = 'myorg-second-app/component/v1';

    const apps = Object.values({
      'myorg-first-app': {
        ...genericAppPluginConfig,
        id: 'myorg-first-app',
      },
      'myorg-second-app': {
        ...genericAppPluginConfig,
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
          ...genericAppPluginConfig.dependencies,
          extensions: {
            exposedComponents: ['myorg-fourth-app/component/v1'],
          },
        },
      },
      'myorg-third-app': {
        ...genericAppPluginConfig,
        id: 'myorg-third-app',
      },
      'myorg-fourth-app': {
        ...genericAppPluginConfig,
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
          ...genericAppPluginConfig.dependencies,
          extensions: {
            exposedComponents: ['myorg-fifth-app/component/v1'],
          },
        },
      },
      'myorg-fifth-app': {
        ...genericAppPluginConfig,
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
    });

    const appPluginIds = getExposedComponentPluginDependenciesSync(exposedComponentId, apps);

    expect(appPluginIds).toEqual(['myorg-second-app', 'myorg-fourth-app', 'myorg-fifth-app']);
  });

  test('should return (recursively) the app plugin ids that register extensions to a link extension point', () => {
    const extensionPointId = 'grafana-exploretraces-app/open-in-explore-traces-button/v1';

    const appPluginIds = getExposedComponentPluginDependenciesSync(extensionPointId, apps);

    expect(appPluginIds).toEqual(['grafana-exploretraces-app', 'grafana-asserts-app', 'grafana-asserts-app']);
  });
});

describe('getAppPluginDependenciesSync', () => {
  test('should not end up in an infinite loop if there are circular dependencies', () => {
    const apps = Object.values({
      'myorg-first-app': {
        ...genericAppPluginConfig,
        id: 'myorg-first-app',
      },
      'myorg-second-app': {
        ...genericAppPluginConfig,
        id: 'myorg-second-app',
        dependencies: {
          ...genericAppPluginConfig.dependencies,
          extensions: {
            exposedComponents: ['myorg-third-app/link/v1'],
          },
        },
      },
      'myorg-third-app': {
        ...genericAppPluginConfig,
        id: 'myorg-third-app',
        dependencies: {
          ...genericAppPluginConfig.dependencies,
          extensions: {
            exposedComponents: ['myorg-second-app/link/v1'],
          },
        },
      },
    });

    const appPluginIds = getAppPluginDependenciesSync('myorg-second-app', apps);

    expect(appPluginIds).toEqual(['myorg-third-app']);
  });

  test('should not end up in an infinite loop if a plugin depends on itself', () => {
    const apps = Object.values({
      'myorg-first-app': {
        ...genericAppPluginConfig,
        id: 'myorg-first-app',
      },
      'myorg-second-app': {
        ...genericAppPluginConfig,
        id: 'myorg-second-app',
        dependencies: {
          ...genericAppPluginConfig.dependencies,
          extensions: {
            // Not a valid scenario!
            // (As this is sometimes happening out in the wild, we thought it's better to also cover it with a test-case.)
            exposedComponents: ['myorg-second-app/link/v1'],
          },
        },
      },
    });

    const appPluginIds = getAppPluginDependenciesSync('myorg-second-app', apps);

    expect(appPluginIds).toEqual([]);
  });

  test('should return (recursively) the app plugin ids dependencies', () => {
    const extensionPointId = 'grafana-exploretraces-app';

    const appPluginIds = getAppPluginDependenciesSync(extensionPointId, apps);

    expect(appPluginIds).toEqual(['grafana-asserts-app', 'grafana-asserts-app']);
  });
});

describe('getExtensionPointPluginMetaSync', () => {
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

  it('should return empty map when no plugins have extensions for the point', () => {
    const apps = Object.values({
      app1: { ...mockApp1, extensions: { ...mockApp1.extensions, addedComponents: [], addedLinks: [] } },
      app2: { ...mockApp2, extensions: { ...mockApp2.extensions, addedComponents: [], addedLinks: [] } },
    });

    const result = getExtensionPointPluginMetaSync(mockExtensionPointId, apps);
    expect(result.size).toBe(0);
  });

  it('should return map with plugins that have components for the extension point', () => {
    const apps = Object.values({
      app1: mockApp1,
      app2: mockApp2,
    });

    const result = getExtensionPointPluginMetaSync(mockExtensionPointId, apps);

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
    const apps = Object.values({
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
    });

    const result = getExtensionPointPluginMetaSync(mockExtensionPointId, apps);

    expect(result.size).toBe(1);
    expect(result.get('app1')).toEqual({
      addedComponents: [{ title: 'Component 1', targets: [mockExtensionPointId] }],
      addedLinks: [{ title: 'Link 1', targets: [mockExtensionPointId] }],
    });
  });

  test('should return map with plugins that have components for the extension point', () => {
    const extensionPointId = PluginExtensionPoints.ExtensionSidebar;

    const result = getExtensionPointPluginMetaSync(extensionPointId, apps);

    expect(result.size).toBe(2);
    expect(result.get('grafana-assistant-app')).toEqual({
      addedComponents: [
        { description: 'Opens Grafana Assistant', title: 'Grafana Assistant', targets: [extensionPointId] },
      ],
      addedLinks: [{ description: 'Opens Grafana Assistant', title: 'Grafana Assistant', targets: [extensionPointId] }],
    });
    expect(result.get('grafana-pathfinder-app')).toEqual({
      addedComponents: [
        { description: 'Opens Interactive learning', title: 'Interactive learning', targets: [extensionPointId] },
      ],
      addedLinks: [
        { description: 'Opens Interactive learning', title: 'Documentation-Link', targets: [extensionPointId] },
      ],
    });
  });
});
