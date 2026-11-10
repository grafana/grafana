import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { invalidatePluginSettingsCache } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { folderAPIv1beta1 } from 'app/api/clients/folder/v1beta1';
import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import { ruleUpdateDependenciesApi } from '../../../api/ruleUpdateDependenciesApi';
import { setupMswServer } from '../../../mockApi';
import { mockFolder, mockGrafanaPromAlertingRule } from '../../../mocks';
import { addPlugin, disablePlugin, failPlugin, removePlugin } from '../../../mocks/server/configure';
import { pluginMeta } from '../../../testSetup/plugins';
import { SupportedPlugin } from '../../../types/pluginBridges';
import { type AsyncAbility } from '../types';

import { usePromRuleAdministrationAbility } from './promRuleAbilities';
import { usePromRuleUpdateAbilities } from './usePromRuleUpdateAbilities';

const server = setupMswServer();
const pluginId = SupportedPlugin.Slo;
const makeRule = (overrides: Parameters<typeof mockGrafanaPromAlertingRule>[0] = {}) =>
  mockGrafanaPromAlertingRule({ uid: 'rule-a', folderUid: 'payments', ...overrides });
const rulesFor = (uids: string[]) => uids.map((uid) => makeRule({ uid, folderUid: uid }));
const folderFor = (uid: string, canEdit = true) =>
  mockFolder({ uid, accessControl: { [AccessControlAction.AlertingRuleUpdate]: canEdit } });
const transientFolderErrors = [false, true].flatMap((appPlatform) =>
  [408, 429, 503].map((status) => ({ appPlatform, status }))
);

function folderPermissionResponse(appPlatform: boolean, canEdit = true) {
  return HttpResponse.json(
    appPlatform
      ? {
          canAdmin: false,
          canDelete: false,
          canEdit,
          canSave: canEdit,
          accessControl: { [AccessControlAction.AlertingRuleUpdate]: canEdit },
        }
      : folderFor('payments', canEdit)
  );
}

let store: ReturnType<typeof configureStore>;

beforeEach(() => {
  store = configureStore();
  removePlugin(pluginId);
  server.use(http.get<{ uid: string }>('/api/folders/:uid', ({ params }) => HttpResponse.json(folderFor(params.uid))));
});

it.each([false, true])(
  'bounds automatic bulk permission refetches with app platform=%s',
  async (appPlatform) => {
    setTestFlags({ foldersAppPlatformAPI: appPlatform });
    const rules = rulesFor(Array.from({ length: 100 }, (_, index) => `folder-${index}`));
    const releases = new Set<() => void>();
    let refreshing = false;
    let blockRefresh = true;
    let started = 0;
    let completed = 0;
    let active = 0;
    let peak = 0;
    const lookup = async (uid: string) => {
      if (refreshing) {
        started++;
        active++;
        peak = Math.max(peak, active);
        if (blockRefresh) {
          await new Promise<void>((resolve) => releases.add(resolve));
        }
        active--;
        completed++;
      }
      return appPlatform
        ? HttpResponse.json({
            canAdmin: false,
            canDelete: false,
            canEdit: !refreshing,
            canSave: !refreshing,
            accessControl: { [AccessControlAction.AlertingRuleUpdate]: !refreshing },
          })
        : HttpResponse.json(folderFor(uid, !refreshing));
    };
    server.use(
      http.get<{ uid: string }>('/api/folders/:uid', ({ params }) => lookup(params.uid)),
      http.get<{ uid: string }>(
        '/apis/folder.grafana.app/:version/namespaces/default/folders/:uid/access',
        ({ params }) => lookup(params.uid)
      ),
      http.patch('/apis/folder.grafana.app/:version/namespaces/default/folders/:uid', () =>
        HttpResponse.json({
          apiVersion: 'folder.grafana.app/v1beta1',
          kind: 'Folder',
          metadata: { name: 'folder-0' },
          spec: { title: 'Updated' },
        })
      )
    );
    const { result, unmount } = renderHook(() => usePromRuleUpdateAbilities(rules, true), {
      wrapper: getWrapper({ store }),
    });

    try {
      await waitFor(() => expect([...result.current.values()]).toEqual(rules.map(() => ({ granted: true }))), {
        timeout: 5000,
      });
      refreshing = true;
      await act(async () => {
        if (appPlatform) {
          await store
            .dispatch(
              folderAPIv1beta1.endpoints.updateFolder.initiate({
                name: 'folder-0',
                patch: { spec: { title: 'Updated' } },
              })
            )
            .unwrap();
        } else {
          store.dispatch(browseDashboardsAPI.util.invalidateTags(['getFolder']));
        }
      });
      await waitFor(() => expect(releases.size).toBe(4));
      expect(started).toBe(4);

      while (completed < rules.length) {
        await waitFor(() => expect(releases.size).toBeGreaterThan(0));
        await act(async () => {
          const batch = [...releases];
          releases.clear();
          batch.forEach((release) => release());
        });
      }
      await waitFor(() =>
        expect([...result.current.values()]).toEqual(
          rules.map(() => ({
            granted: false,
            cause: 'INSUFFICIENT_PERMISSIONS',
            anyOfPermissions: [AccessControlAction.AlertingRuleUpdate],
          }))
        )
      );
      expect(started).toBe(rules.length);
      expect(peak).toBe(4);
    } finally {
      unmount();
      blockRefresh = false;
      await act(async () => {
        releases.forEach((release) => release());
        releases.clear();
        const running = appPlatform
          ? store.dispatch(folderAPIv1beta1.util.getRunningQueriesThunk())
          : store.dispatch(browseDashboardsAPI.util.getRunningQueriesThunk());
        await Promise.all(running);
      });
    }
  },
  15000
);

it.each([false, true])('updates permissions after RTK Query invalidation with app platform=%s', async (appPlatform) => {
  setTestFlags({ foldersAppPlatformAPI: appPlatform });
  let canEdit = true;
  let requests = 0;
  server.use(
    http.get('/api/folders/payments', () => {
      requests++;
      return HttpResponse.json(folderFor('payments', canEdit));
    }),
    http.get('/apis/folder.grafana.app/:version/namespaces/default/folders/payments/access', () => {
      requests++;
      return HttpResponse.json({
        canAdmin: false,
        canDelete: false,
        canEdit,
        canSave: canEdit,
        accessControl: { [AccessControlAction.AlertingRuleUpdate]: canEdit },
      });
    })
  );
  const rules = [makeRule()];
  const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, true), { wrapper: getWrapper({ store }) });

  await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: true }));
  expect(requests).toBe(1);

  canEdit = false;
  act(() => {
    store.dispatch(
      appPlatform
        ? folderAPIv1beta1.util.invalidateTags(['Folder'])
        : browseDashboardsAPI.util.invalidateTags(['getFolder'])
    );
  });
  await waitFor(() =>
    expect(result.current.get('rule-a')).toMatchObject({ granted: false, cause: 'INSUFFICIENT_PERMISSIONS' })
  );
  expect(requests).toBe(2);

  canEdit = true;
  act(() => {
    store.dispatch(
      appPlatform
        ? folderAPIv1beta1.util.invalidateTags(['Folder'])
        : browseDashboardsAPI.util.invalidateTags(['getFolder'])
    );
  });
  await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: true }));
  expect(requests).toBe(3);
});

it.each(
  [false, true].flatMap((appPlatform) =>
    ['payments', 'constructor', 'toString', '__proto__', 'LIST'].map((uid) => ({ appPlatform, uid }))
  )
)('keeps single and bulk abilities aligned for $uid with app platform=$appPlatform', async ({ appPlatform, uid }) => {
  setTestFlags({ foldersAppPlatformAPI: appPlatform });
  let canEdit = true;
  server.use(
    http.get('/api/folders/:uid', () => HttpResponse.json(folderFor(uid, canEdit))),
    http.get('/apis/folder.grafana.app/:version/namespaces/default/folders/:uid', () =>
      HttpResponse.json({
        apiVersion: 'folder.grafana.app/v1beta1',
        kind: 'Folder',
        metadata: { name: uid, uid, resourceVersion: '1', creationTimestamp: '2025-01-01T00:00:00Z' },
        spec: { title: uid },
      })
    ),
    http.get('/apis/folder.grafana.app/:version/namespaces/default/folders/:uid/parents', () =>
      HttpResponse.json({ items: [] })
    ),
    http.get('/apis/folder.grafana.app/:version/namespaces/default/folders/:uid/access', () =>
      HttpResponse.json({
        canAdmin: false,
        canDelete: false,
        canEdit,
        canSave: canEdit,
        accessControl: { [AccessControlAction.AlertingRuleUpdate]: canEdit },
      })
    )
  );
  const rule = makeRule({ folderUid: uid });
  const rules = [rule];
  const { result } = renderHook(
    () => ({
      single: usePromRuleAdministrationAbility(rule).update,
      bulk: usePromRuleUpdateAbilities(rules, true).get(rule.uid),
    }),
    { wrapper: getWrapper({ store }) }
  );

  await waitFor(() => expect(result.current).toEqual({ single: { granted: true }, bulk: { granted: true } }));
  canEdit = false;
  act(() => {
    store.dispatch(
      appPlatform
        ? folderAPIv1beta1.util.invalidateTags(['Folder'])
        : browseDashboardsAPI.util.invalidateTags(['getFolder'])
    );
  });
  await waitFor(() =>
    expect(result.current).toMatchObject({
      single: { granted: false, cause: 'INSUFFICIENT_PERMISSIONS' },
      bulk: { granted: false, cause: 'INSUFFICIENT_PERMISSIONS' },
    })
  );
});

it.each(transientFolderErrors)(
  'keeps transient folder lookups loading until recovery ($status), app platform=$appPlatform',
  async ({ appPlatform, status }) => {
    setTestFlags({ foldersAppPlatformAPI: appPlatform });
    let requests = 0;
    const lookup = () => {
      requests++;
      return requests === 1 ? HttpResponse.json({}, { status }) : folderPermissionResponse(appPlatform);
    };
    server.use(
      http.get('/api/folders/payments', lookup),
      http.get('/apis/folder.grafana.app/:version/namespaces/default/folders/payments/access', lookup)
    );
    const rules = [makeRule()];
    const observed: Array<AsyncAbility | undefined> = [];
    const { result } = renderHook(
      () => {
        const abilities = usePromRuleUpdateAbilities(rules, true);
        observed.push(abilities.get('rule-a'));
        return abilities;
      },
      { wrapper: getWrapper({ store }) }
    );

    expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'LOADING' });
    await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: true }), { timeout: 3000 });
    expect(requests).toBe(2);
    expect(observed).not.toContainEqual({ granted: false, cause: 'LOOKUP_FAILED' });
  }
);

it.each(transientFolderErrors)(
  'retries invalidated folder permissions ($status), app platform=$appPlatform',
  async ({ appPlatform, status }) => {
    setTestFlags({ foldersAppPlatformAPI: appPlatform });
    let requests = 0;
    const lookup = () => {
      requests++;
      return requests === 2 ? HttpResponse.json({}, { status }) : folderPermissionResponse(appPlatform, requests === 1);
    };
    server.use(
      http.get('/api/folders/payments', lookup),
      http.get('/apis/folder.grafana.app/:version/namespaces/default/folders/payments/access', lookup)
    );
    const rules = [makeRule()];
    const observed: Array<AsyncAbility | undefined> = [];
    const { result } = renderHook(
      () => {
        const abilities = usePromRuleUpdateAbilities(rules, true);
        observed.push(abilities.get('rule-a'));
        return abilities;
      },
      { wrapper: getWrapper({ store }) }
    );

    await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: true }));
    act(() => {
      store.dispatch(
        appPlatform
          ? folderAPIv1beta1.util.invalidateTags(['Folder'])
          : browseDashboardsAPI.util.invalidateTags(['getFolder'])
      );
    });
    await waitFor(
      () =>
        expect(result.current.get('rule-a')).toMatchObject({
          granted: false,
          cause: 'INSUFFICIENT_PERMISSIONS',
        }),
      { timeout: 3000 }
    );
    expect(requests).toBe(3);
    expect(observed).not.toContainEqual({ granted: false, cause: 'LOOKUP_FAILED' });
  }
);

it.each([403, 404])('keeps a permanent folder error (%s) distinct from permission denial', async (status) => {
  let requests = 0;
  server.use(
    http.get('/api/folders/payments', () => {
      requests++;
      return HttpResponse.json({}, { status });
    })
  );
  const { result } = renderHook(() => usePromRuleUpdateAbilities([makeRule()], true), {
    wrapper: getWrapper({ store }),
  });

  await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'LOOKUP_FAILED' }));
  expect(requests).toBe(1);
});

it('bounds transient retries and permits retrying after re-enabling', async () => {
  let requests = 0;
  let failing = true;
  server.use(
    http.get('/api/folders/payments', () => {
      requests++;
      return failing ? HttpResponse.json({}, { status: 503 }) : HttpResponse.json(folderFor('payments'));
    })
  );
  const rules = [makeRule()];
  const { result, rerender } = renderHook(({ enabled }) => usePromRuleUpdateAbilities(rules, enabled), {
    initialProps: { enabled: true },
    wrapper: getWrapper({ store }),
  });

  await waitFor(() => expect(requests).toBe(3), { timeout: 4000 });
  await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'LOOKUP_FAILED' }));
  failing = false;
  rerender({ enabled: false });
  expect(result.current.size).toBe(0);
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: true }));
  expect(requests).toBe(4);
});

it('reuses fulfilled RTK queries when the candidate set changes', async () => {
  const requested: string[] = [];
  server.use(
    http.get<{ uid: string }>('/api/folders/:uid', ({ params }) => {
      requested.push(params.uid);
      return HttpResponse.json(folderFor(params.uid));
    })
  );
  const { result, rerender } = renderHook(({ uids }) => usePromRuleUpdateAbilities(rulesFor(uids), true), {
    initialProps: { uids: ['payments'] },
    wrapper: getWrapper({ store }),
  });

  await waitFor(() => expect(result.current.get('payments')).toEqual({ granted: true }));
  rerender({ uids: ['payments', 'platform'] });
  await waitFor(() => expect(result.current.get('platform')).toEqual({ granted: true }));
  expect(requested).toEqual(['payments', 'platform']);
});

it.each(['constructor', 'toString', '__proto__', 'LIST'])(
  'resolves and invalidates folder UID %s without tag collisions',
  async (uid) => {
    let canEdit = true;
    server.use(http.get('/api/folders/:uid', () => HttpResponse.json(folderFor(uid, canEdit))));
    const { result } = renderHook(() => usePromRuleUpdateAbilities(rulesFor([uid]), true), {
      wrapper: getWrapper({ store }),
    });

    expect(result.current.get(uid)).toEqual({ granted: false, cause: 'LOADING' });
    await waitFor(() => expect(result.current.get(uid)).toEqual({ granted: true }));
    canEdit = false;
    act(() => {
      store.dispatch(browseDashboardsAPI.util.invalidateTags(['getFolder']));
    });
    await waitFor(() =>
      expect(result.current.get(uid)).toEqual({
        granted: false,
        cause: 'INSUFFICIENT_PERMISSIONS',
        anyOfPermissions: [AccessControlAction.AlertingRuleUpdate],
      })
    );
  }
);

it('bounds query subscriptions across candidate changes and drops queued work on unmount', async () => {
  const requested: string[] = [];
  const release = new Map<string, () => void>();
  server.use(
    http.get<{ uid: string }>('/api/folders/:uid', async ({ params }) => {
      requested.push(params.uid);
      await new Promise<void>((resolve) => release.set(params.uid, resolve));
      return HttpResponse.json(folderFor(params.uid));
    })
  );
  const { unmount, rerender } = renderHook(({ uids }) => usePromRuleUpdateAbilities(rulesFor(uids), true), {
    initialProps: { uids: ['a', 'b', 'c', 'd', 'e', 'f'] },
    wrapper: getWrapper({ store }),
  });

  await waitFor(() => expect(requested).toHaveLength(4));
  rerender({ uids: ['g', 'h'] });
  expect(requested).toHaveLength(4);
  act(() => {
    release.get('a')?.();
  });
  await waitFor(() => expect(requested).toEqual(['a', 'b', 'c', 'd', 'g']));
  unmount();
  await act(async () => {
    release.forEach((complete) => complete());
    await Promise.all(store.dispatch(browseDashboardsAPI.util.getRunningQueriesThunk()));
  });
  expect(requested).toEqual(['a', 'b', 'c', 'd', 'g']);
});

it('deduplicates folder and plugin queries across candidates', async () => {
  const requested: string[] = [];
  server.events.on('request:start', ({ request }) => {
    requested.push(new URL(request.url).pathname);
  });
  const rules = ['a', 'b'].map((uid) => makeRule({ uid, labels: { __grafana_origin: `plugin/${pluginId}` } }));
  const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, true), { wrapper: getWrapper({ store }) });

  await waitFor(() => expect([...result.current.values()]).toEqual([{ granted: true }, { granted: true }]));
  expect(requested.filter((path) => path === '/api/folders/payments')).toHaveLength(1);
  expect(requested.filter((path) => path === `/api/plugins/${pluginId}/settings`)).toHaveLength(1);
  server.events.removeAllListeners('request:start');
});

it('does not query dependencies when disabled', async () => {
  const requested: string[] = [];
  server.events.on('request:start', ({ request }) => {
    requested.push(request.url);
  });
  const { result } = renderHook(() => usePromRuleUpdateAbilities([makeRule()], false), {
    wrapper: getWrapper({ store }),
  });

  expect(result.current.size).toBe(0);
  expect(requested).toEqual([]);
  server.events.removeAllListeners('request:start');
});

it.each(['enabled', 'disabled', 'missing'] as const)(
  'agrees with normal editing for a %s originating plugin',
  async (state) => {
    if (state === 'enabled') {
      addPlugin(pluginMeta[pluginId]);
    } else if (state === 'disabled') {
      disablePlugin(pluginId);
    }
    const rule = makeRule({ labels: { __grafana_origin: `plugin/${pluginId}` } });
    const { result } = renderHook(
      () => ({
        single: usePromRuleAdministrationAbility(rule).update,
        bulk: usePromRuleUpdateAbilities([rule], true).get(rule.uid),
      }),
      { wrapper: getWrapper({ store }) }
    );

    const expected = state === 'enabled' ? { granted: false, cause: 'IS_PLUGIN_MANAGED' } : { granted: true };
    await waitFor(() => expect(result.current).toEqual({ single: expected, bulk: expected }));
  }
);

it('observes plugin query invalidation rather than copying plugin results locally', async () => {
  addPlugin(pluginMeta[pluginId]);
  const rules = [makeRule({ labels: { __grafana_origin: `plugin/${pluginId}` } })];
  const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, true), { wrapper: getWrapper({ store }) });

  await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'IS_PLUGIN_MANAGED' }));
  disablePlugin(pluginId);
  act(() => {
    store.dispatch(
      ruleUpdateDependenciesApi.util.invalidateTags([{ type: 'RulePluginEnabled', id: `plugin:${pluginId}` }])
    );
  });
  await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: true }));
});

it('retries invalidated plugin settings while remaining loading', async () => {
  setTestFlags({ foldersAppPlatformAPI: false });
  let requests = 0;
  server.use(
    http.get(`/api/plugins/${pluginId}/settings`, () => {
      requests++;
      return requests === 2
        ? HttpResponse.json({}, { status: 503 })
        : HttpResponse.json({ ...pluginMeta[pluginId], enabled: requests === 1 });
    })
  );
  const rules = [makeRule({ labels: { __grafana_origin: `plugin/${pluginId}` } })];
  const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, true), { wrapper: getWrapper({ store }) });

  await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'IS_PLUGIN_MANAGED' }));
  invalidatePluginSettingsCache(pluginId);
  act(() => {
    store.dispatch(
      ruleUpdateDependenciesApi.util.invalidateTags([{ type: 'RulePluginEnabled', id: `plugin:${pluginId}` }])
    );
  });
  await waitFor(() => expect(requests).toBe(2));
  expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'LOADING' });
  await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: true }), { timeout: 3000 });
  expect(requests).toBe(3);
});

it('keeps plugin lookup failures distinct from permission denials', async () => {
  failPlugin(pluginId, 403);
  const rules = [makeRule({ labels: { __grafana_origin: `plugin/${pluginId}` } })];
  const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, true), { wrapper: getWrapper({ store }) });

  await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'LOOKUP_FAILED' }));
});

it.each(['constructor', 'toString', '__proto__'])(
  'resolves a missing plugin named %s without tag collisions',
  async (id) => {
    const rules = [makeRule({ labels: { __grafana_origin: `plugin/${id}` } })];
    const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, true), { wrapper: getWrapper({ store }) });

    await waitFor(() => expect(result.current.get('rule-a')).toEqual({ granted: true }));
  }
);
