import { HttpResponse, http } from 'msw';
import { act, getWrapper, renderHook, waitFor } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { folderAPIv1beta1 } from 'app/api/clients/folder/v1beta1';
import { browseDashboardsAPI } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { install, uninstall } from 'app/features/plugins/admin/state/actions';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';

import { legacyRuleFolderPermissionsApi, ruleFolderPermissionsApi } from '../../../api/ruleUpdateDependenciesApi';
import { setupMswServer } from '../../../mockApi';
import { mockFolder, mockGrafanaPromAlertingRule } from '../../../mocks';
import { removePlugin } from '../../../mocks/server/configure';
import { pluginMeta } from '../../../testSetup/plugins';
import { SupportedPlugin } from '../../../types/pluginBridges';

import { usePromRuleUpdateAbilities } from './usePromRuleUpdateAbilities';

const server = setupMswServer();
const pluginId = SupportedPlugin.Slo;
let store: ReturnType<typeof configureStore>;

beforeEach(() => {
  store = configureStore();
  removePlugin(pluginId);
  setTestFlags({ foldersAppPlatformAPI: false });
  server.use(
    http.get<{ uid: string }>('/api/folders/:uid', ({ params }) =>
      HttpResponse.json(
        mockFolder({ uid: params.uid, accessControl: { [AccessControlAction.AlertingRuleUpdate]: true } })
      )
    ),
    http.get('/api/frontend/settings', () => HttpResponse.json({ panels: {} }))
  );
});

function folderRefetchScenario(appPlatform: boolean, count: number) {
  setTestFlags({ foldersAppPlatformAPI: appPlatform });
  const uids = Array.from({ length: count }, (_, index) => `folder-${index}`);
  const rules = uids.map((uid) => mockGrafanaPromAlertingRule({ uid, folderUid: uid }));
  const releases = new Set<() => void>();
  const requested: string[] = [];
  let refreshing = false;
  let blocked = true;
  const lookup = async (uid: string) => {
    if (refreshing) {
      requested.push(uid);
      if (blocked) {
        await new Promise<void>((resolve) => releases.add(resolve));
      }
    }
    const accessControl = { [AccessControlAction.AlertingRuleUpdate]: !refreshing };
    return HttpResponse.json(appPlatform ? { accessControl } : mockFolder({ uid, accessControl }));
  };
  server.use(
    http.get<{ uid: string }>('/api/folders/:uid', ({ params }) => lookup(params.uid)),
    http.get<{ uid: string }>(
      '/apis/folder.grafana.app/:version/namespaces/default/folders/:uid/access',
      ({ params }) => lookup(params.uid)
    )
  );
  return {
    rules,
    uids,
    requested,
    endpoint: appPlatform
      ? ruleFolderPermissionsApi.endpoints.getBulkRuleFolderPermissions
      : legacyRuleFolderPermissionsApi.endpoints.getBulkRuleFolderPermissions,
    invalidate() {
      refreshing = true;
      store.dispatch(
        appPlatform
          ? folderAPIv1beta1.util.invalidateTags(['Folder'])
          : browseDashboardsAPI.util.invalidateTags(['getFolder'])
      );
    },
    release() {
      blocked = false;
      releases.forEach((release) => release());
      releases.clear();
    },
    async settle() {
      this.release();
      const running = appPlatform
        ? store.dispatch(folderAPIv1beta1.util.getRunningQueriesThunk())
        : store.dispatch(browseDashboardsAPI.util.getRunningQueriesThunk());
      await Promise.all(running);
    },
  };
}

it.each([false, true].flatMap((appPlatform) => ['disable', 'unmount'].map((stop) => ({ appPlatform, stop }))))(
  'cancels queued invalidation refetches on $stop, app platform=$appPlatform',
  async ({ appPlatform, stop }) => {
    const scenario = folderRefetchScenario(appPlatform, 100);
    const view = renderHook(({ enabled }) => usePromRuleUpdateAbilities(scenario.rules, enabled), {
      initialProps: { enabled: true },
      wrapper: getWrapper({ store }),
    });
    try {
      await waitFor(
        () => expect([...view.result.current.values()]).toEqual(scenario.rules.map(() => ({ granted: true }))),
        {
          timeout: 5000,
        }
      );
      act(() => scenario.invalidate());
      await waitFor(() => expect(scenario.requested).toHaveLength(4));

      if (stop === 'disable') {
        view.rerender({ enabled: false });
      } else {
        view.unmount();
      }
      await waitFor(() =>
        expect(scenario.uids.every((uid) => scenario.endpoint.select(uid)(store.getState()).isUninitialized)).toBe(true)
      );
      await act(() => scenario.settle());
      expect(scenario.requested).toHaveLength(4);
    } finally {
      view.unmount();
      await act(() => scenario.settle());
    }
  },
  10000
);

it.each([false, true])(
  'keeps shared refetches alive until the last consumer leaves, app platform=%s',
  async (appPlatform) => {
    const scenario = folderRefetchScenario(appPlatform, 8);
    const { unmount: unmountFirst } = renderHook(() => usePromRuleUpdateAbilities(scenario.rules, true), {
      wrapper: getWrapper({ store }),
    });
    const { result, unmount: unmountRemaining } = renderHook(() => usePromRuleUpdateAbilities(scenario.rules, true), {
      wrapper: getWrapper({ store }),
    });
    try {
      await waitFor(() => expect([...result.current.values()]).toEqual(scenario.rules.map(() => ({ granted: true }))));
      act(() => scenario.invalidate());
      await waitFor(() => expect(scenario.requested).toHaveLength(4));
      unmountFirst();
      await act(() => scenario.settle());
      await waitFor(() =>
        expect([...result.current.values()]).toEqual(
          scenario.rules.map(() => ({
            granted: false,
            cause: 'INSUFFICIENT_PERMISSIONS',
            anyOfPermissions: [AccessControlAction.AlertingRuleUpdate],
          }))
        )
      );
      expect(scenario.requested).toHaveLength(8);
    } finally {
      unmountFirst();
      unmountRemaining();
      await act(() => scenario.settle());
    }
  }
);

it.each([false, true])('refreshes ownership after production uninstall with remount=%s', async (remount) => {
  let installed = true;
  server.use(
    http.get(`/api/plugins/${pluginId}/settings`, () =>
      installed ? HttpResponse.json({ ...pluginMeta[pluginId], enabled: true }) : HttpResponse.json({}, { status: 404 })
    ),
    http.post(`/api/plugins/${pluginId}/uninstall`, () => {
      installed = false;
      return HttpResponse.json({});
    })
  );
  const rule = mockGrafanaPromAlertingRule({
    uid: 'owned',
    folderUid: 'payments',
    labels: { __grafana_origin: `plugin/${pluginId}` },
  });
  const rules = [rule];
  let view = renderHook(() => usePromRuleUpdateAbilities(rules, true), { wrapper: getWrapper({ store }) });
  try {
    await waitFor(() =>
      expect(view.result.current.get(rule.uid)).toEqual({ granted: false, cause: 'IS_PLUGIN_MANAGED' })
    );
    if (remount) {
      view.unmount();
    }
    await act(async () => {
      await store.dispatch(uninstall(pluginId)).unwrap();
    });
    if (remount) {
      view = renderHook(() => usePromRuleUpdateAbilities(rules, true), { wrapper: getWrapper({ store }) });
    }
    await waitFor(() => expect(view.result.current.get(rule.uid)).toEqual({ granted: true }));
  } finally {
    view.unmount();
  }
});

it('refreshes cached missing-plugin ownership after production install', async () => {
  let installed = false;
  server.use(
    http.get(`/api/plugins/${pluginId}/settings`, () =>
      installed ? HttpResponse.json({ ...pluginMeta[pluginId], enabled: true }) : HttpResponse.json({}, { status: 404 })
    ),
    http.post(`/api/plugins/${pluginId}/install`, () => {
      installed = true;
      return HttpResponse.json({});
    })
  );
  const rule = mockGrafanaPromAlertingRule({
    uid: 'owned',
    folderUid: 'payments',
    labels: { __grafana_origin: `plugin/${pluginId}` },
  });
  const view = renderHook(() => usePromRuleUpdateAbilities([rule], true), { wrapper: getWrapper({ store }) });
  try {
    await waitFor(() => expect(view.result.current.get(rule.uid)).toEqual({ granted: true }));
    await act(async () => {
      await store.dispatch(install({ id: pluginId })).unwrap();
    });
    await waitFor(() =>
      expect(view.result.current.get(rule.uid)).toEqual({ granted: false, cause: 'IS_PLUGIN_MANAGED' })
    );
  } finally {
    view.unmount();
  }
});
