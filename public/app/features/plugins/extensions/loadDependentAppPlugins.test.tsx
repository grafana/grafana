import { PluginLoadingStrategy } from '@grafana/data';
import { clearAppPluginMetas, setAppPluginMetas } from '@grafana/runtime/internal';

import { preloadPlugins } from '../pluginPreloader';

import { loadDependentAppPlugins } from './loadDependentAppPlugins';

jest.mock('../pluginPreloader', () => ({
  preloadPlugins: jest.fn().mockResolvedValue(undefined),
}));

const preloadPluginsMock = jest.mocked(preloadPlugins);

describe('loadDependentAppPlugins()', () => {
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

  beforeEach(() => {
    clearAppPluginMetas();
    preloadPluginsMock.mockClear();
  });

  test('should preload the app plugins resolved by the predicate', async () => {
    const app1 = { ...genereicAppPluginConfig, id: 'myorg-first-app' };
    const app2 = { ...genereicAppPluginConfig, id: 'myorg-second-app' };
    setAppPluginMetas({ [app1.id]: app1, [app2.id]: app2 });

    const predicate = jest.fn().mockResolvedValue(['myorg-first-app']);

    await loadDependentAppPlugins('some-id', predicate);

    expect(predicate).toHaveBeenCalledWith('some-id');
    expect(preloadPluginsMock).toHaveBeenCalledWith([app1]);
  });

  test('should not preload anything if the predicate resolves no plugin ids', async () => {
    const predicate = jest.fn().mockResolvedValue([]);

    await loadDependentAppPlugins('some-id', predicate);

    expect(preloadPluginsMock).not.toHaveBeenCalled();
  });

  test('should not preload anything if none of the resolved ids match a known app plugin', async () => {
    setAppPluginMetas({});
    const predicate = jest.fn().mockResolvedValue(['unknown-app-id']);

    await loadDependentAppPlugins('some-id', predicate);

    expect(preloadPluginsMock).not.toHaveBeenCalled();
  });
});
