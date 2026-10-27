import { act } from 'test/test-utils';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { MOCK_STARRED_KIND, MOCK_STARRED_KIND_APP, setTestFlags } from '@grafana/test-utils/unstable';

import {
  findStarredKind,
  findStarredKindBySearchKind,
  getStarredKinds,
  initStarredKinds,
  starredKindsNeedIcons,
  starredNavEntry,
} from './kinds';

const THING = `${MOCK_STARRED_KIND.group}/${MOCK_STARRED_KIND.kind}`;

afterEach(async () => {
  await act(async () => {
    setTestFlags({});
  });
  initStarredKinds([]);
});

describe('getStarredKinds', () => {
  it('lists only dashboards when folders cannot be starred and no plugin declares a kind', () => {
    initStarredKinds([]);

    expect(getStarredKinds().map((kind) => kind.searchKind)).toEqual(['dashboard']);
    expect(starredKindsNeedIcons()).toBe(false);
  });

  it('lists dashboards, folders, then plugin kinds in declaration order with increasing ranks', () => {
    setTestFlags({ 'grafana.starredFolders': true, foldersAppPlatformAPI: true });
    const second = { ...MOCK_STARRED_KIND, kind: 'Widget', title: 'Widget', path: '/a/test-things-app/widgets/{name}' };
    initStarredKinds([{ ...MOCK_STARRED_KIND_APP, starredKinds: [MOCK_STARRED_KIND, second] }]);

    expect(getStarredKinds().map((kind) => [kind.searchKind, kind.sortWeight, kind.pluginId])).toEqual([
      ['dashboard', 0, undefined],
      ['folder', 1, undefined],
      [THING, 2, MOCK_STARRED_KIND_APP.id],
      ['things.ext.grafana.app/Widget', 3, MOCK_STARRED_KIND_APP.id],
    ]);
    expect(starredKindsNeedIcons()).toBe(true);
  });

  it('finds a declared kind by group and kind, and by its search kind string', () => {
    initStarredKinds([MOCK_STARRED_KIND_APP]);

    expect(findStarredKind(MOCK_STARRED_KIND.group, MOCK_STARRED_KIND.kind)?.title).toBe('Thing');
    expect(findStarredKindBySearchKind(THING)?.icon).toBe('cube');
    expect(findStarredKindBySearchKind('panel')).toBeUndefined();
  });
});

describe('plugin kind urls', () => {
  afterEach(() => {
    locationUtil.initialize({
      config: { appSubUrl: '' } as GrafanaConfig,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });
  });

  it('fills the path placeholder with the encoded name under the app sub url', () => {
    locationUtil.initialize({
      config: { appSubUrl: '/grafana' } as GrafanaConfig,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });
    initStarredKinds([MOCK_STARRED_KIND_APP]);

    expect(findStarredKindBySearchKind(THING)?.url('a b/c')).toBe('/grafana/a/test-things-app/things/a%20b%2Fc');
  });
});

describe('starredNavEntry', () => {
  it('leaves dashboard rows icon-free while dashboards are the only kind', () => {
    initStarredKinds([]);

    expect(starredNavEntry(findStarredKindBySearchKind('dashboard')!, 'd1')).toEqual({
      url: '/d/d1',
      icon: undefined,
      sortWeight: 0,
      kind: 'dashboard',
    });
  });

  it('gives every kind its icon and rank once a plugin kind is declared', () => {
    initStarredKinds([MOCK_STARRED_KIND_APP]);

    expect(starredNavEntry(findStarredKindBySearchKind('dashboard')!, 'd1')).toEqual({
      url: '/d/d1',
      icon: 'apps',
      sortWeight: 0,
      kind: 'dashboard',
    });
    expect(starredNavEntry(findStarredKindBySearchKind(THING)!, 't1')).toEqual({
      url: '/a/test-things-app/things/t1',
      icon: 'cube',
      sortWeight: 2,
      kind: THING,
    });
  });
});
