import type * as StoreModule from './textSandboxConsent';

type Store = typeof StoreModule;

const mockUser = { id: 1, orgId: 1 };
jest.mock('app/core/services/context_srv', () => ({ contextSrv: { user: mockUser } }));

const storageKey = () => `grafana.dashboard.textSandbox.allowedOrigins.${mockUser.orgId}.${mockUser.id}`;

function loadStore(): Store {
  let store!: Store;
  jest.isolateModules(() => {
    store = require('./textSandboxConsent');
  });
  return store;
}

const users = 'https://users.example.com';
const avatars = 'https://avatars.example.com';

const grant = (origin: string, ...panelIds: Array<number | undefined>) => [{ origin, panelIds }];

afterEach(() => {
  jest.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockUser.id = 1;
  mockUser.orgId = 1;
});

describe('allowed origins', () => {
  it('limits "Allow" to the panels it was given for', () => {
    const store = loadStore();
    store.allowOrigins(grant(users, 1, 2), 'dashboard', 'dash-a');
    expect(store.getAllowedOrigins('dash-a', 1)).toEqual([users]);
    expect(store.getAllowedOrigins('dash-a', 2)).toEqual([users]);
    expect(store.getAllowedOrigins('dash-a', 3)).toEqual([]);
    expect(store.getAllowedOrigins('dash-b', 1)).toEqual([]);
  });

  it('keeps "Allow" across a reload, in session storage', () => {
    loadStore().allowOrigins(grant(users, 1), 'dashboard', 'dash-a');
    window.localStorage.clear();
    expect(loadStore().getAllowedOrigins('dash-a', 1)).toEqual([users]);

    window.sessionStorage.clear();
    expect(loadStore().getAllowedOrigins('dash-a', 1)).toEqual([]);
  });

  it('applies "Always allow" to every panel and dashboard and keeps it in local storage', () => {
    loadStore().allowOrigins(grant(users, 1), 'always', 'dash-a');
    window.sessionStorage.clear();
    const reloaded = loadStore();
    reloaded.allowOrigins(grant(avatars, 1), 'dashboard', 'dash-b');
    expect(reloaded.getAllowedOrigins('dash-b', 1)).toEqual([avatars, users]);
    expect(reloaded.getAllowedOrigins('dash-c', 7)).toEqual([users]);
  });

  it('does not share consent with another user or org in the same browser', () => {
    const store = loadStore();
    store.allowOrigins(grant(users), 'always');
    store.allowOrigins(grant(avatars, 1), 'dashboard', 'dash-a');

    mockUser.id = 2;
    expect(store.getAllowedOrigins('dash-a', 1)).toEqual([]);
    mockUser.id = 1;
    mockUser.orgId = 2;
    expect(loadStore().getAllowedOrigins('dash-a', 1)).toEqual([]);
  });

  it('picks up "Always allow" given in another tab', () => {
    const store = loadStore();
    expect(store.getAllowedOrigins('dash-a', 1)).toEqual([]);

    window.localStorage.setItem(storageKey(), JSON.stringify([users]));
    expect(store.getAllowedOrigins('dash-a', 1)).toEqual([]);
    window.dispatchEvent(new StorageEvent('storage', { key: storageKey() }));
    expect(store.getAllowedOrigins('dash-a', 1)).toEqual([users]);
  });

  it('keeps consent in memory when storage is unavailable', () => {
    const blocked = () => {
      throw new Error('blocked');
    };
    jest.spyOn(window, 'localStorage', 'get').mockImplementation(blocked);
    jest.spyOn(window, 'sessionStorage', 'get').mockImplementation(blocked);
    const store = loadStore();
    store.allowOrigins(grant(users), 'always');
    store.allowOrigins(grant(avatars, 1), 'dashboard', 'dash-a');
    expect(store.getAllowedOrigins('dash-a', 1)).toEqual([avatars, users]);
    expect(loadStore().getAllowedOrigins('dash-a', 1)).toEqual([]);
  });
});

describe('blocked summary', () => {
  it('merges panels hitting the same origin and sorts origins by image count', () => {
    const store = loadStore();
    store.reportBlocked('panel-1', {
      dashboardUid: 'dash-a',
      panelTitle: 'Text sample',
      origins: [{ origin: users, urls: [{ url: `${users}/a.png`, count: 2 }] }],
    });
    store.reportBlocked('panel-2', {
      dashboardUid: 'dash-a',
      panelTitle: 'Mixed image sources',
      origins: [
        { origin: users, urls: [{ url: `${users}/a.png`, count: 1 }] },
        {
          origin: avatars,
          urls: [
            { url: `${avatars}/1.png`, count: 1 },
            { url: `${avatars}/2.png`, count: 1 },
          ],
        },
      ],
    });
    store.reportBlocked('other-dashboard', {
      dashboardUid: 'dash-b',
      panelTitle: 'Elsewhere',
      origins: [{ origin: 'https://other.example.com', urls: [] }],
    });

    expect(store.getBlockedSummary('dash-a')).toEqual([
      {
        origin: users,
        host: 'users.example.com',
        panels: ['Text sample', 'Mixed image sources'],
        panelIds: [undefined],
        urls: [{ url: `${users}/a.png`, count: 3 }],
        count: 3,
      },
      {
        origin: avatars,
        host: 'avatars.example.com',
        panels: ['Mixed image sources'],
        panelIds: [undefined],
        urls: [
          { url: `${avatars}/1.png`, count: 1 },
          { url: `${avatars}/2.png`, count: 1 },
        ],
        count: 2,
      },
    ]);
  });

  it('limits the summary to one panel when given a panel id', () => {
    const store = loadStore();
    store.reportBlocked('panel-1', {
      dashboardUid: 'dash-a',
      panelId: 1,
      panelTitle: 'Users',
      origins: [{ origin: users, urls: [{ url: `${users}/a.png`, count: 1 }] }],
    });
    store.reportBlocked('panel-2', {
      dashboardUid: 'dash-a',
      panelId: 2,
      panelTitle: 'Avatars',
      origins: [{ origin: avatars, urls: [{ url: `${avatars}/a.png`, count: 1 }] }],
    });

    expect(store.getBlockedSummary('dash-a', 2).map((source) => source.origin)).toEqual([avatars]);
    expect(store.getBlockedSummary('dash-a').map((source) => source.origin)).toEqual([avatars, users]);
  });

  it('does not cover a panel that was not listed when the source was allowed', () => {
    const store = loadStore();
    store.reportBlocked('panel-1', {
      dashboardUid: 'dash-a',
      panelId: 1,
      panelTitle: 'Listed',
      origins: [{ origin: users, urls: [{ url: `${users}/a.png`, count: 1 }] }],
    });
    store.allowOrigins(store.getBlockedSummary('dash-a'), 'dashboard', 'dash-a');
    expect(store.getBlockedSummary('dash-a')).toEqual([]);

    store.reportBlocked('panel-2', {
      dashboardUid: 'dash-a',
      panelId: 2,
      panelTitle: 'Scrolled into view later',
      origins: [{ origin: users, urls: [{ url: `${users}/leak?d=secret`, count: 1 }] }],
    });
    expect(store.getBlockedSummary('dash-a')).toEqual([
      expect.objectContaining({ origin: users, panelIds: [2], urls: [{ url: `${users}/leak?d=secret`, count: 1 }] }),
    ]);
  });

  it('drops allowed origins and panels that stopped reporting', () => {
    const store = loadStore();
    const origins = [
      { origin: users, urls: [{ url: `${users}/a.png`, count: 1 }] },
      { origin: avatars, urls: [{ url: `${avatars}/a.png`, count: 1 }] },
    ];
    store.reportBlocked('panel-1', { dashboardUid: 'dash-a', panelTitle: 'Users', origins });
    store.allowOrigins(grant(users, undefined), 'dashboard', 'dash-a');
    expect(store.getBlockedSummary('dash-a').map((source) => source.origin)).toEqual([avatars]);

    store.clearBlocked('panel-1');
    expect(store.getBlockedSummary('dash-a')).toEqual([]);
  });
});
