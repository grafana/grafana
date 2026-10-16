import { getPluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { getAppPluginConfigs, getExtensionPointPluginDependencies } from 'app/features/plugins/extensions/utils';
import { preloadPlugins } from 'app/features/plugins/pluginPreloader';

import { loadPendingChangePreview } from './pendingChangePreview';

jest.mock('app/features/plugins/extensions/registry/setup', () => ({ getPluginExtensionRegistries: jest.fn() }));
jest.mock('app/features/plugins/extensions/utils', () => ({
  getAppPluginConfigs: jest.fn(async () => []),
  getExtensionPointPluginDependencies: jest.fn(),
}));
jest.mock('app/features/plugins/pluginPreloader', () => ({ preloadPlugins: jest.fn(async () => undefined) }));

const pending = { baseGeneration: 3, proposed: { title: 'Proposed' } };

function registerLoaders(...loaders: unknown[]) {
  jest.mocked(getExtensionPointPluginDependencies).mockResolvedValue(['grafana-assistant-app']);
  jest.mocked(getPluginExtensionRegistries).mockResolvedValue({
    addedFunctionsRegistry: {
      getState: async () => ({ 'grafana/dashboard/pending-changes/v1': loaders.map((fn) => ({ fn })) }),
    },
  } as unknown as Awaited<ReturnType<typeof getPluginExtensionRegistries>>);
}

describe('loadPendingChangePreview', () => {
  afterEach(() => jest.useRealTimers());

  it('previews the pending changes a plugin returns', async () => {
    registerLoaders(async () => pending);

    await expect(loadPendingChangePreview('page', 'abc', 'chat-1')).resolves.toMatchObject({ id: 'chat-1', pending });
  });

  it('asks no plugin without a pending changes id', async () => {
    const load = jest.fn();
    registerLoaders(load);

    await expect(loadPendingChangePreview('page', 'abc', undefined)).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  // A ?pendingChanges link must never keep the saved dashboard from opening.
  it('shows the saved dashboard when a loader throws, rejects, or never answers', async () => {
    registerLoaders(() => {
      throw new Error('broken plugin');
    });
    await expect(loadPendingChangePreview('page', 'abc', 'chat-1')).resolves.toBeUndefined();

    registerLoaders(async () => Promise.reject(new Error('backend down')));
    await expect(loadPendingChangePreview('page', 'abc', 'chat-1')).resolves.toBeUndefined();

    jest.useFakeTimers();
    registerLoaders(() => new Promise(() => {}));
    const hanging = loadPendingChangePreview('page', 'abc', 'chat-1');
    await jest.advanceTimersByTimeAsync(10_000);
    await expect(hanging).resolves.toBeUndefined();
  });

  it('shows the saved dashboard when the loader plugins cannot be found or loaded', async () => {
    jest.mocked(getExtensionPointPluginDependencies).mockRejectedValue(new Error('no plugin metadata'));
    await expect(loadPendingChangePreview('page', 'abc', 'chat-1')).resolves.toBeUndefined();

    jest.mocked(getExtensionPointPluginDependencies).mockResolvedValue(['grafana-assistant-app']);
    jest.mocked(preloadPlugins).mockRejectedValueOnce(new Error('failed to load'));
    jest.mocked(getAppPluginConfigs).mockResolvedValue([]);
    await expect(loadPendingChangePreview('page', 'abc', 'chat-1')).resolves.toBeUndefined();
  });
});
