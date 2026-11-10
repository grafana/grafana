import { act, renderHook } from '@testing-library/react';

import { getAppPluginEnabled, useAppPluginEnabled } from '@grafana/runtime';
import { getFolderByUidFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { contextSrv } from 'app/core/services/context_srv';
import { useFolder } from 'app/features/alerting/unified/hooks/useFolder';
import { mockFolder } from 'app/features/alerting/unified/mocks';
import { type GrafanaPromRuleDTO, PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';

import { usePromRuleAdministrationAbility } from './promRuleAbilities';
import { usePromRuleUpdateAbilities } from './usePromRuleUpdateAbilities';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getAppPluginEnabled: jest.fn(),
  useAppPluginEnabled: jest.fn(),
}));
jest.mock('app/api/clients/folder/v1beta1/hooks', () => ({ getFolderByUidFacade: jest.fn() }));
jest.mock('app/features/alerting/unified/hooks/useFolder', () => ({ useFolder: jest.fn() }));

const folder = mockFolder({ uid: 'payments' });

function makeRule(overrides: Partial<GrafanaPromRuleDTO> = {}): GrafanaPromRuleDTO {
  return {
    name: 'Rule A',
    query: 'vector(1)',
    uid: 'rule-a',
    folderUid: 'payments',
    isPaused: false,
    health: 'ok',
    state: PromAlertingRuleState.Inactive,
    type: PromRuleType.Alerting,
    totals: {},
    totalsFiltered: {},
    ...overrides,
  };
}

function rulesFor(uids: string[]) {
  return uids.map((uid) => makeRule({ uid, folderUid: uid }));
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(getFolderByUidFacade).mockReset().mockResolvedValue(folder);
  jest.mocked(getAppPluginEnabled).mockReset().mockResolvedValue(false);
  jest.mocked(useAppPluginEnabled).mockReset().mockReturnValue({ loading: false, value: false, error: undefined });
  jest.mocked(useFolder).mockReset().mockReturnValue({ folder, loading: false });
  jest.spyOn(contextSrv, 'hasPermissionInMetadata').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it.each([
  { failure: 'server error', error: { status: 503, data: {} } },
  { failure: 'request timeout', error: { status: 408, data: {} } },
  { failure: 'rate limit', error: { status: 429, data: {} } },
  { failure: 'network error', error: new TypeError('Failed to fetch') },
])('recovers from a transient $failure', async ({ error }) => {
  jest.mocked(getFolderByUidFacade).mockRejectedValueOnce(error).mockResolvedValue(folder);
  const rules = [makeRule()];
  const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, true));

  await act(async () => jest.advanceTimersByTime(0));
  expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'LOADING' });

  await act(async () => jest.advanceTimersByTime(1000));
  expect(getFolderByUidFacade).toHaveBeenCalledTimes(2);
  expect(result.current.get('rule-a')).toEqual({ granted: true });
});

it.each([403, 404])('reports a permanent folder error (%s) without retrying or calling it a denial', async (status) => {
  jest.mocked(getFolderByUidFacade).mockRejectedValue({ status, data: {} });
  const { result } = renderHook(() => usePromRuleUpdateAbilities([makeRule()], true));

  await act(async () => jest.advanceTimersByTime(0));
  await act(async () => jest.advanceTimersByTime(5000));

  expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'LOOKUP_FAILED' });
  expect(getFolderByUidFacade).toHaveBeenCalledTimes(1);
});

it('bounds retries and retries exhausted transient errors when re-enabled', async () => {
  jest.mocked(getFolderByUidFacade).mockRejectedValue({ status: 503, data: {} });
  const rules = [makeRule()];
  const { result, rerender } = renderHook(({ enabled }) => usePromRuleUpdateAbilities(rules, enabled), {
    initialProps: { enabled: true },
  });

  await act(async () => jest.advanceTimersByTime(0));
  await act(async () => jest.advanceTimersByTime(1000));
  await act(async () => jest.advanceTimersByTime(1000));
  await act(async () => jest.advanceTimersByTime(5000));
  expect(getFolderByUidFacade).toHaveBeenCalledTimes(3);
  expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'LOOKUP_FAILED' });

  jest.mocked(getFolderByUidFacade).mockResolvedValue(folder);
  rerender({ enabled: false });
  expect(result.current.size).toBe(0);
  rerender({ enabled: true });
  await act(async () => jest.advanceTimersByTime(0));
  expect(result.current.get('rule-a')).toEqual({ granted: true });
});

it('cancels a scheduled retry on unmount', async () => {
  jest.mocked(getFolderByUidFacade).mockRejectedValue({ status: 503, data: {} });
  const { unmount } = renderHook(() => usePromRuleUpdateAbilities([makeRule()], true));

  await act(async () => jest.advanceTimersByTime(0));
  unmount();
  await act(async () => jest.advanceTimersByTime(5000));
  expect(getFolderByUidFacade).toHaveBeenCalledTimes(1);
});

it('keeps successful lookups across rule-set changes', async () => {
  const { rerender } = renderHook(({ uids }) => usePromRuleUpdateAbilities(rulesFor(uids), true), {
    initialProps: { uids: ['payments'] },
  });

  await act(async () => jest.advanceTimersByTime(0));
  rerender({ uids: ['payments', 'platform'] });
  await act(async () => jest.advanceTimersByTime(0));
  expect(jest.mocked(getFolderByUidFacade).mock.calls).toEqual([['payments'], ['platform']]);
});

it.each(['constructor', 'toString', '__proto__'])(
  'resolves a prototype-property folder uid %s normally',
  async (uid) => {
    const { result } = renderHook(() => usePromRuleUpdateAbilities(rulesFor([uid]), true));

    expect(getFolderByUidFacade).toHaveBeenCalledWith(uid);
    expect(result.current.get(uid)).toEqual({ granted: false, cause: 'LOADING' });
    await act(async () => jest.advanceTimersByTime(0));
    expect(result.current.get(uid)).toEqual({ granted: true });
  }
);

it('shares the concurrency budget across rule-set changes and drops queued reads on unmount', async () => {
  const release: Array<() => void> = [];
  jest
    .mocked(getFolderByUidFacade)
    .mockImplementation(() => new Promise((resolve) => release.push(() => resolve(folder))));
  const { unmount, rerender } = renderHook(({ uids }) => usePromRuleUpdateAbilities(rulesFor(uids), true), {
    initialProps: { uids: ['a', 'b', 'c', 'd', 'e', 'f'] },
  });

  expect(getFolderByUidFacade).toHaveBeenCalledTimes(4);
  rerender({ uids: ['g', 'h'] });
  expect(getFolderByUidFacade).toHaveBeenCalledTimes(4);
  await act(async () => release[0]());
  expect(getFolderByUidFacade).toHaveBeenCalledTimes(5);
  expect(getFolderByUidFacade).toHaveBeenLastCalledWith('g');

  unmount();
  await act(async () => release.forEach((complete) => complete()));
  expect(getFolderByUidFacade).toHaveBeenCalledTimes(5);
});

it('deduplicates folder and plugin lookups across rules', async () => {
  const rules = ['a', 'b'].map((uid) => makeRule({ uid, labels: { __grafana_origin: 'plugin/slo-app' } }));
  const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, true));

  await act(async () => jest.advanceTimersByTime(0));
  expect(getFolderByUidFacade).toHaveBeenCalledTimes(1);
  expect(getAppPluginEnabled).toHaveBeenCalledTimes(1);
  expect(getAppPluginEnabled).toHaveBeenCalledWith('slo-app');
  expect([...result.current.values()]).toEqual([{ granted: true }, { granted: true }]);
});

it('does not look up any dependencies when disabled', async () => {
  const rules = [makeRule({ labels: { __grafana_origin: 'plugin/slo-app' } })];
  const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, false));

  await act(async () => jest.advanceTimersByTime(0));
  expect(result.current.size).toBe(0);
  expect(getFolderByUidFacade).not.toHaveBeenCalled();
  expect(getAppPluginEnabled).not.toHaveBeenCalled();
});

it('waits for plugin ownership before granting update access', async () => {
  let resolvePlugin: (enabled: boolean) => void = () => {};
  jest.mocked(getAppPluginEnabled).mockImplementation(() => new Promise((resolve) => (resolvePlugin = resolve)));
  const rules = [makeRule({ labels: { __grafana_origin: 'plugin/slo-app' } })];
  const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, true));

  await act(async () => jest.advanceTimersByTime(0));
  expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'LOADING' });
  await act(async () => resolvePlugin(true));
  expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'IS_PLUGIN_MANAGED' });
});

it('keeps failed plugin lookups distinct from permission denial', async () => {
  jest.mocked(getAppPluginEnabled).mockRejectedValue(new Error('Forbidden', { cause: { status: 403, data: {} } }));
  const rules = [makeRule({ labels: { __grafana_origin: 'plugin/slo-app' } })];
  const { result } = renderHook(() => usePromRuleUpdateAbilities(rules, true));

  await act(async () => jest.advanceTimersByTime(0));
  await act(async () => jest.advanceTimersByTime(5000));
  expect(result.current.get('rule-a')).toEqual({ granted: false, cause: 'LOOKUP_FAILED' });
  expect(getAppPluginEnabled).toHaveBeenCalledTimes(1);
});

it.each([
  { name: 'editable', canEdit: true, pluginEnabled: false, overrides: {} },
  { name: 'permission denied', canEdit: false, pluginEnabled: false, overrides: {} },
  { name: 'provisioned', canEdit: true, pluginEnabled: false, overrides: { provenance: 'file' } },
  {
    name: 'enabled plugin',
    canEdit: true,
    pluginEnabled: true,
    overrides: { labels: { __grafana_origin: 'plugin/slo-app' } },
  },
  {
    name: 'disabled plugin',
    canEdit: true,
    pluginEnabled: false,
    overrides: { labels: { __grafana_origin: 'plugin/slo-app' } },
  },
])('agrees with the single-rule update ability for $name', async ({ canEdit, pluginEnabled, overrides }) => {
  jest.mocked(contextSrv.hasPermissionInMetadata).mockReturnValue(canEdit);
  jest.mocked(getAppPluginEnabled).mockResolvedValue(pluginEnabled);
  jest.mocked(useAppPluginEnabled).mockReturnValue({ loading: false, value: pluginEnabled, error: undefined });
  const rule = makeRule(overrides);
  const rules = [rule];
  const { result } = renderHook(() => ({
    single: usePromRuleAdministrationAbility(rule).update,
    bulk: usePromRuleUpdateAbilities(rules, true).get(rule.uid),
  }));

  await act(async () => jest.advanceTimersByTime(0));
  expect(result.current.bulk).toEqual(result.current.single);
});

it('agrees with the single-rule update ability when a folder lookup fails', async () => {
  const error = new Error('Folder lookup failed');
  jest.mocked(useFolder).mockReturnValue({ loading: false, error });
  jest.mocked(getFolderByUidFacade).mockRejectedValue({ status: 403, data: {} });
  const rule = makeRule();
  const { result } = renderHook(() => ({
    single: usePromRuleAdministrationAbility(rule).update,
    bulk: usePromRuleUpdateAbilities([rule], true).get(rule.uid),
  }));

  await act(async () => jest.advanceTimersByTime(0));
  expect(result.current.bulk).toEqual({ granted: false, cause: 'LOOKUP_FAILED' });
  expect(result.current.single).toEqual(result.current.bulk);
});
