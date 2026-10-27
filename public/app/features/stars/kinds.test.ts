import { act } from 'test/test-utils';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { MOCK_STARRED_KIND, setTestFlags } from '@grafana/test-utils/unstable';

import {
  findStarredKind,
  findStarredKindBySearchKind,
  getStarredKinds,
  getStarredKindsVersion,
  registerStarredKind,
  starredKindsNeedIcons,
  starredNavEntry,
  subscribeStarredKinds,
} from './kinds';

const THING = `${MOCK_STARRED_KIND.group}/${MOCK_STARRED_KIND.kind}`;
const unregisters: Array<() => void> = [];
const register = (...registrations: Array<typeof MOCK_STARRED_KIND>) =>
  registrations.forEach((registration) => unregisters.push(registerStarredKind(registration)));

afterEach(async () => {
  await act(async () => {
    setTestFlags({});
  });
  unregisters.splice(0).forEach((unregister) => unregister());
});

describe('getStarredKinds', () => {
  it('lists only dashboards when folders cannot be starred and no kind is registered', () => {
    expect(getStarredKinds().map((kind) => kind.searchKind)).toEqual(['dashboard']);
    expect(starredKindsNeedIcons()).toBe(false);
  });

  it('lists dashboards, folders, then plugin kinds in registration order with increasing ranks', () => {
    setTestFlags({ 'grafana.starredFolders': true, foldersAppPlatformAPI: true });
    register(MOCK_STARRED_KIND, {
      ...MOCK_STARRED_KIND,
      kind: 'Widget',
      title: 'Widget',
      listUrl: '/a/test-things-app/widgets',
    });

    expect(getStarredKinds().map((kind) => [kind.searchKind, kind.sortWeight, kind.source])).toEqual([
      ['dashboard', 0, 'dashboard-search'],
      ['folder', 1, 'dashboard-search'],
      [THING, 2, 'kind-search'],
      ['things.ext.grafana.app/Widget', 3, 'kind-search'],
    ]);
    expect(starredKindsNeedIcons()).toBe(true);
  });

  it('finds a registered kind by group and kind, and by its search kind string', () => {
    register(MOCK_STARRED_KIND);

    expect(findStarredKind(MOCK_STARRED_KIND.group, MOCK_STARRED_KIND.kind)?.title).toBe('Thing');
    expect(findStarredKindBySearchKind(THING)?.icon).toBe('cube');
    expect(findStarredKindBySearchKind('panel')).toBeUndefined();
  });
});

describe('registerStarredKind', () => {
  it('replaces an earlier registration of the same kind and forgets it on unregister', () => {
    const unregister = registerStarredKind({ ...MOCK_STARRED_KIND, title: 'Old thing' });
    register({ ...MOCK_STARRED_KIND, title: 'New thing' });

    expect(findStarredKindBySearchKind(THING)?.title).toBe('New thing');

    // The stale handle no longer owns the kind, so it must not remove the newer registration
    unregister();
    expect(findStarredKindBySearchKind(THING)?.title).toBe('New thing');

    unregisters.splice(0).forEach((fn) => fn());
    expect(findStarredKindBySearchKind(THING)).toBeUndefined();
  });

  it('bumps the version and notifies subscribers on register and unregister', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeStarredKinds(listener);
    const before = getStarredKindsVersion();

    const unregister = registerStarredKind(MOCK_STARRED_KIND);
    expect(getStarredKindsVersion()).toBe(before + 1);
    unregister();
    expect(getStarredKindsVersion()).toBe(before + 2);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    register(MOCK_STARRED_KIND);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('falls back to a generic icon when the registration names none', () => {
    register({ ...MOCK_STARRED_KIND, icon: undefined });

    expect(findStarredKindBySearchKind(THING)?.icon).toBe('cube');
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

  it("appends the encoded name to the kind's list url, under the app sub url", () => {
    locationUtil.initialize({
      config: { appSubUrl: '/grafana' } as GrafanaConfig,
      getTimeRangeForUrl: jest.fn(),
      getVariablesUrlParams: jest.fn(),
    });
    register(MOCK_STARRED_KIND);

    expect(findStarredKindBySearchKind(THING)?.url('a b/c')).toBe('/grafana/a/test-things-app/things/a%20b%2Fc');
  });

  it('tolerates a trailing slash on the list url', () => {
    register({ ...MOCK_STARRED_KIND, listUrl: '/a/test-things-app/things/' });

    expect(findStarredKindBySearchKind(THING)?.url('t1')).toBe('/a/test-things-app/things/t1');
  });
});

describe('starredNavEntry', () => {
  it('leaves dashboard rows icon-free while dashboards are the only kind', () => {
    expect(starredNavEntry(findStarredKindBySearchKind('dashboard')!, 'd1')).toEqual({
      url: '/d/d1',
      icon: undefined,
      sortWeight: 0,
      kind: 'dashboard',
    });
  });

  it('gives every kind its icon and rank once a plugin kind is registered', () => {
    register(MOCK_STARRED_KIND);

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
