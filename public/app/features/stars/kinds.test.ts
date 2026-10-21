import { act } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { clearAppPluginMetas, setAppPluginMetas } from '@grafana/runtime/internal';
import { MOCK_STARRED_KIND, MOCK_STARRED_KIND_APP, setTestFlags } from '@grafana/test-utils/unstable';

import {
  findStarredKind,
  findStarredKindBySearchKind,
  getStarredKinds,
  loadStarredKinds,
  starredKindForUrl,
  starredKindsNeedIcons,
  starredNavEntry,
} from './kinds';

const THING = `${MOCK_STARRED_KIND.group}/${MOCK_STARRED_KIND.kind}`;

afterEach(async () => {
  await act(async () => {
    setTestFlags({});
  });
  setAppPluginMetas({});
  await loadStarredKinds();
  clearAppPluginMetas();
  config.appSubUrl = '';
});

describe('getStarredKinds', () => {
  it('lists only dashboards when folders cannot be starred and no plugin declares a kind', async () => {
    setAppPluginMetas({});
    await loadStarredKinds();

    expect(getStarredKinds().map((kind) => kind.searchKind)).toEqual(['dashboard']);
    expect(starredKindsNeedIcons()).toBe(false);
  });

  it('lists dashboards, folders, then plugin kinds in declaration order with increasing ranks', async () => {
    setTestFlags({ 'grafana.starredFolders': true, foldersAppPlatformAPI: true });
    const second = { ...MOCK_STARRED_KIND, kind: 'Widget', title: 'Widget', path: '/a/test-things-app/widgets/{name}' };
    setAppPluginMetas({
      [MOCK_STARRED_KIND_APP.id]: { ...MOCK_STARRED_KIND_APP, starredKinds: [MOCK_STARRED_KIND, second] },
    });

    const kinds = await loadStarredKinds();

    expect(kinds.map((kind) => [kind.searchKind, kind.sortWeight, kind.source, kind.editable])).toEqual([
      ['dashboard', 0, 'dashboard-search', true],
      ['folder', 1, 'dashboard-search', true],
      [THING, 2, 'kind-search', false],
      ['things.ext.grafana.app/Widget', 3, 'kind-search', false],
    ]);
    expect(starredKindsNeedIcons()).toBe(true);
  });

  it('keeps a plugin kind visible to the synchronous readers once loaded', async () => {
    setAppPluginMetas({ [MOCK_STARRED_KIND_APP.id]: MOCK_STARRED_KIND_APP });
    expect(findStarredKindBySearchKind(THING)).toBeUndefined();

    await loadStarredKinds();

    expect(findStarredKind(MOCK_STARRED_KIND.group, MOCK_STARRED_KIND.kind)?.title).toBe('Thing');
    expect(findStarredKindBySearchKind(THING)?.icon).toBe('cube');
  });
});

describe('plugin kind urls', () => {
  it('fills the path placeholder with the encoded name under the app sub url', async () => {
    config.appSubUrl = '/grafana';
    setAppPluginMetas({ [MOCK_STARRED_KIND_APP.id]: MOCK_STARRED_KIND_APP });
    await loadStarredKinds();

    expect(findStarredKindBySearchKind(THING)?.url('a b/c')).toBe('/grafana/a/test-things-app/things/a%20b%2Fc');
  });

  it('reads the kind back from a starred link, defaulting to dashboards', async () => {
    setTestFlags({ 'grafana.starredFolders': true, foldersAppPlatformAPI: true });
    setAppPluginMetas({ [MOCK_STARRED_KIND_APP.id]: MOCK_STARRED_KIND_APP });
    await loadStarredKinds();

    expect(starredKindForUrl('/a/test-things-app/things/t1?orgId=1').searchKind).toBe(THING);
    expect(starredKindForUrl('/dashboards/f/f1/').searchKind).toBe('folder');
    expect(starredKindForUrl('/d/d1/my-dash').searchKind).toBe('dashboard');
  });
});

describe('starredNavEntry', () => {
  it('leaves dashboard rows icon-free while dashboards are the only kind', async () => {
    setAppPluginMetas({});
    await loadStarredKinds();

    expect(starredNavEntry(findStarredKindBySearchKind('dashboard')!, 'd1')).toEqual({
      url: '/d/d1',
      icon: undefined,
      sortWeight: 0,
    });
  });

  it('gives every kind its icon and rank once a plugin kind is declared', async () => {
    setAppPluginMetas({ [MOCK_STARRED_KIND_APP.id]: MOCK_STARRED_KIND_APP });
    await loadStarredKinds();

    expect(starredNavEntry(findStarredKindBySearchKind('dashboard')!, 'd1')).toEqual({
      url: '/d/d1',
      icon: 'apps',
      sortWeight: 0,
    });
    expect(starredNavEntry(findStarredKindBySearchKind(THING)!, 't1')).toEqual({
      url: '/a/test-things-app/things/t1',
      icon: 'cube',
      sortWeight: 2,
    });
  });
});
