import { locationService } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { getPluginExtensionRegistries } from 'app/features/plugins/extensions/registry/setup';
import { getAppPluginConfigs, getExtensionPointPluginDependencies } from 'app/features/plugins/extensions/utils';
import { preloadPlugins } from 'app/features/plugins/pluginPreloader';

import {
  clearPendingChangePreview,
  finishSavingNewDashboard,
  getPendingChangePreview,
  isHighlightingChanges,
  loadPendingChangePreview,
  previewedDashboardUid,
  setHighlightingChanges,
  showOriginal,
  withoutPendingChangesPreview,
} from './pendingChangePreview';

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

// Plugin-provided pending changes are behind Grafana Assistant's flag; the tests below need it on.
beforeEach(() => setTestFlags({ 'assistant.dashboard.artifacts': true }));
afterEach(() => setTestFlags({}));

describe('loadPendingChangePreview', () => {
  afterEach(() => jest.useRealTimers());

  it('asks no plugin while plugin-provided pending changes are off', async () => {
    setTestFlags({});
    const load = jest.fn();
    registerLoaders(load);

    await expect(loadPendingChangePreview('page', 'abc', 'chat-1')).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
    expect(getExtensionPointPluginDependencies).not.toHaveBeenCalled();
  });

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

// The page keeps the choice in its URL, so a plugin linking to it can tell what it shows.
describe('showing the saved dashboard instead of the pending changes', () => {
  afterEach(() => locationService.push('/'));

  it('is the dashboard page URL', async () => {
    registerLoaders(async () => pending);
    locationService.push('/d/abc?pendingChanges=chat-1');
    const reload = jest.fn(async () => undefined);

    await showOriginal('page', 'abc', 'chat-1', true, reload);
    expect(locationService.getSearchObject()).toMatchObject({
      pendingChanges: 'chat-1',
      pendingChangesView: 'original',
    });
    await expect(loadPendingChangePreview('page', 'abc', 'chat-1')).resolves.toMatchObject({ previewing: false });
    // The embedded view keeps its own choice.
    await expect(loadPendingChangePreview('embedded', 'abc', 'chat-1')).resolves.toMatchObject({ previewing: true });

    await showOriginal('page', 'abc', 'chat-1', false, reload);
    expect(locationService.getSearchObject().pendingChangesView).toBeUndefined();
    // The page reloads itself when its URL changes.
    expect(reload).not.toHaveBeenCalled();
  });

  it('is remembered for the tab by the embedded view, which reloads itself', async () => {
    registerLoaders(async () => pending);
    const reload = jest.fn(async () => undefined);

    await showOriginal('embedded', 'abc', 'chat-1', true, reload);
    await expect(loadPendingChangePreview('embedded', 'abc', 'chat-1')).resolves.toMatchObject({ previewing: false });
    await expect(loadPendingChangePreview('page', 'abc', 'chat-1')).resolves.toMatchObject({ previewing: true });

    await showOriginal('embedded', 'abc', 'chat-1', false, reload);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe('a new dashboard proposed as pending changes', () => {
  const proposal = () => ({ ...pending, baseGeneration: 0, discard: jest.fn(async () => undefined) });

  it('is always previewed: there is no saved dashboard to show instead', async () => {
    registerLoaders(async () => proposal());
    locationService.push('/d/new-dash?pendingChanges=chat-1&pendingChangesView=original');

    await expect(loadPendingChangePreview('page', 'new-dash', 'chat-1')).resolves.toMatchObject({ previewing: true });
    locationService.push('/');
  });

  it('is found by the uid it was proposed under while its scene has none', () => {
    expect(previewedDashboardUid({ uid: '', meta: { newDashboardUid: 'new-dash' } })).toBe('new-dash');
    expect(previewedDashboardUid({ uid: 'abc', meta: {} })).toBe('abc');
    expect(previewedDashboardUid({ uid: '', meta: {} })).toBeUndefined();
  });

  it('is discarded in the plugin and forgotten once it was saved', async () => {
    const proposed = proposal();
    registerLoaders(async () => proposed);
    await loadPendingChangePreview('page', 'new-dash', 'chat-1');

    await finishSavingNewDashboard('new-dash');

    expect(proposed.discard).toHaveBeenCalledTimes(1);
    expect(getPendingChangePreview('page', 'new-dash')).toBeUndefined();
  });

  it('leaves the page URL without its preview', () => {
    expect(withoutPendingChangesPreview('?pendingChanges=chat-1&orgId=1')).toBe('?orgId=1');
    expect(withoutPendingChangesPreview('?pendingChanges=chat-1&pendingChangesView=original')).toBe('');
    expect(withoutPendingChangesPreview('?pendingChanges=chat-1')).toBe('');
  });
});

describe('highlighting the pending changes', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('is on by default, keeps being turned off for the tab per dashboard and pending changes, and resets once they are cleared', () => {
    expect(isHighlightingChanges('dash', 'chat-1')).toBe(true);

    setHighlightingChanges('dash', 'chat-1', false);
    expect(isHighlightingChanges('dash', 'chat-1')).toBe(false);
    expect(isHighlightingChanges('dash', 'chat-2')).toBe(true);

    clearPendingChangePreview('dash', 'chat-1');
    expect(isHighlightingChanges('dash', 'chat-1')).toBe(true);
  });
});
