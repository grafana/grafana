import { act, renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';
import { Provider } from 'react-redux';

import { store } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';

import * as useAlertManagerSources from '../hooks/useAlertManagerSources';
import { setupMswServer } from '../mockApi';
import { useRouteProxyActive } from '../plugin-proxy/withRouteProxy';
import { setupPrometheusAlertingPlugin } from '../testSetup/prometheusAlertingPlugin';
import { type AlertManagerDataSource, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import {
  AlertmanagerProvider,
  getOrgAlertmanagerLocalStorageKey,
  isAlertManagerWithConfigAPI,
  useAlertmanager,
} from './AlertmanagerContext';

const externalAmProm: AlertManagerDataSource = {
  name: 'PrometheusAm',
  imgUrl: '',
};

const externalAmMimir: AlertManagerDataSource = {
  name: 'MimirAm',
  imgUrl: '',
};

function getProviderWrapper() {
  const reduxStore = configureStore();
  return ({ children }: React.PropsWithChildren) => (
    <Provider store={reduxStore}>
      <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
    </Provider>
  );
}

describe('useAlertmanager', () => {
  it('Should return undefined alert manager name when there are no available alert managers', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValueOnce({ availableExternalDataSources: [], availableInternalDataSources: [] });
    const wrapper = getProviderWrapper();

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(undefined);
  });

  it('Should return Grafana AM when it is available and no alert manager query param exists', () => {
    jest.spyOn(useAlertManagerSources, 'useAlertManagersByPermission').mockReturnValueOnce({
      availableExternalDataSources: [],
      availableInternalDataSources: [{ name: GRAFANA_RULES_SOURCE_NAME, imgUrl: '', hasConfigurationAPI: true }],
    });

    const wrapper = getProviderWrapper();

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(GRAFANA_RULES_SOURCE_NAME);
  });

  it('Should return alert manager included in the query param when available', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValueOnce({ availableExternalDataSources: [externalAmProm], availableInternalDataSources: [] });

    locationService.push({ search: `alertmanager=${externalAmProm.name}` });

    const wrapper = getProviderWrapper();

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(externalAmProm.name);
  });

  it('Should return undefined if alert manager included in the query is not available', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValueOnce({ availableExternalDataSources: [], availableInternalDataSources: [] });

    locationService.push({ search: `alertmanager=Not available external AM` });

    const wrapper = getProviderWrapper();

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(undefined);
  });

  it('Should return alert manager from store if available and query is empty', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValueOnce({ availableExternalDataSources: [externalAmProm], availableInternalDataSources: [] });

    const wrapper = getProviderWrapper();

    store.set(getOrgAlertmanagerLocalStorageKey(config.bootData.user.orgId), externalAmProm.name);
    locationService.push({ search: '' });
    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(externalAmProm.name);
  });

  it('Should prioritize the alert manager from query over store', () => {
    jest.spyOn(useAlertManagerSources, 'useAlertManagersByPermission').mockReturnValueOnce({
      availableExternalDataSources: [externalAmProm, externalAmMimir],
      availableInternalDataSources: [],
    });

    locationService.push({ search: `alertmanager=${externalAmProm.name}` });

    const wrapper = getProviderWrapper();

    store.set(getOrgAlertmanagerLocalStorageKey(config.bootData.user.orgId), externalAmMimir.name);

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(externalAmProm.name);
  });

  it('Should fall back to Grafana AM when stored AM is not available', () => {
    jest.spyOn(useAlertManagerSources, 'useAlertManagersByPermission').mockReturnValueOnce({
      availableExternalDataSources: [],
      availableInternalDataSources: [{ name: GRAFANA_RULES_SOURCE_NAME, imgUrl: '', hasConfigurationAPI: true }],
    });

    const orgKey = getOrgAlertmanagerLocalStorageKey(config.bootData.user.orgId);
    store.set(orgKey, 'NonExistentAM');
    locationService.push({ search: '' });

    const wrapper = getProviderWrapper();
    const { result } = renderHook(() => useAlertmanager(), { wrapper });

    expect(result.current.selectedAlertmanager).toBe(GRAFANA_RULES_SOURCE_NAME);
  });

  it('Should clean up stale localStorage entry when stored AM is not available', () => {
    jest.spyOn(useAlertManagerSources, 'useAlertManagersByPermission').mockReturnValueOnce({
      availableExternalDataSources: [],
      availableInternalDataSources: [{ name: GRAFANA_RULES_SOURCE_NAME, imgUrl: '', hasConfigurationAPI: true }],
    });

    const orgKey = getOrgAlertmanagerLocalStorageKey(config.bootData.user.orgId);
    store.set(orgKey, 'NonExistentAM');
    locationService.push({ search: '' });

    const wrapper = getProviderWrapper();
    renderHook(() => useAlertmanager(), { wrapper });

    expect(store.get(orgKey)).toBeUndefined();
  });

  it('Should not read localStorage from a different org', () => {
    jest.spyOn(useAlertManagerSources, 'useAlertManagersByPermission').mockReturnValueOnce({
      availableExternalDataSources: [externalAmProm],
      availableInternalDataSources: [{ name: GRAFANA_RULES_SOURCE_NAME, imgUrl: '', hasConfigurationAPI: true }],
    });

    const otherOrgKey = getOrgAlertmanagerLocalStorageKey(999);
    store.set(otherOrgKey, externalAmProm.name);
    locationService.push({ search: '' });

    const wrapper = getProviderWrapper();
    const { result } = renderHook(() => useAlertmanager(), { wrapper });

    expect(result.current.selectedAlertmanager).toBe(GRAFANA_RULES_SOURCE_NAME);
  });
});

describe('useAlertmanager and the hand-over to the Prometheus Alerting plugin', () => {
  const grafanaAm: AlertManagerDataSource = { name: GRAFANA_RULES_SOURCE_NAME, imgUrl: '', hasConfigurationAPI: true };
  const storageKey = getOrgAlertmanagerLocalStorageKey(config.bootData.user.orgId);

  setupMswServer();

  beforeEach(() => {
    jest.spyOn(useAlertManagerSources, 'useAlertManagersByPermission').mockReturnValue({
      availableExternalDataSources: [externalAmProm],
      availableInternalDataSources: [grafanaAm],
    });
    store.delete(storageKey);
    locationService.push({ search: '' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // The provider holds back external Alertmanagers while the plugin check is out too, so the tests
  // wait for a check of their own to come back before asserting, to be sure they see the settled page.
  function renderWithRouteProxyCheck() {
    return renderHook(() => ({ alertmanager: useAlertmanager(), routeProxyActive: useRouteProxyActive() }), {
      wrapper: getProviderWrapper(),
    });
  }

  describe('while the hand-over is active', () => {
    setupPrometheusAlertingPlugin();

    it('selects the Grafana Alertmanager even though an external one is stored', async () => {
      store.set(storageKey, externalAmProm.name);

      const { result } = renderWithRouteProxyCheck();

      await waitFor(() => expect(result.current.routeProxyActive).toBe(true));
      expect(result.current.alertmanager.selectedAlertmanager).toBe(GRAFANA_RULES_SOURCE_NAME);
    });

    it('puts a picked external Alertmanager in the URL without storing it', async () => {
      const { result } = renderWithRouteProxyCheck();
      await waitFor(() => expect(result.current.routeProxyActive).toBe(true));

      act(() => result.current.alertmanager.setSelectedAlertmanager(externalAmProm.name));

      expect(locationService.getSearch().get('alertmanager')).toBe(externalAmProm.name);
      expect(store.get(storageKey)).toBeUndefined();
    });
  });

  describe('while the hand-over is switched off', () => {
    it('stores a picked external Alertmanager and puts it in the URL', () => {
      const { result } = renderHook(() => useAlertmanager(), { wrapper: getProviderWrapper() });

      act(() => result.current.setSelectedAlertmanager(externalAmProm.name));

      expect(locationService.getSearch().get('alertmanager')).toBe(externalAmProm.name);
      expect(store.get(storageKey)).toBe(externalAmProm.name);
    });
  });

  describe('with the hand-over switched on but the plugin not installed', () => {
    const unifiedAlertingEnabled = config.unifiedAlertingEnabled;

    beforeEach(() => {
      config.unifiedAlertingEnabled = true;
      setTestFlags({ [FlagKeys.AlertingDataSourceManagedRouteProxy]: true });
    });

    afterEach(() => {
      config.unifiedAlertingEnabled = unifiedAlertingEnabled;
    });

    it('uses the stored external Alertmanager once the plugin check comes back', async () => {
      store.set(storageKey, externalAmProm.name);

      const { result } = renderHook(() => useAlertmanager(), { wrapper: getProviderWrapper() });

      // Until the check comes back we can't tell whether the stored choice belongs to the plugin.
      expect(result.current.selectedAlertmanager).toBe(GRAFANA_RULES_SOURCE_NAME);
      await waitFor(() => expect(result.current.selectedAlertmanager).toBe(externalAmProm.name));
    });
  });
});

test('isAlertManagerWithConfigAPI', () => {
  expect(
    isAlertManagerWithConfigAPI({
      implementation: undefined,
    })
  ).toBe(true);

  expect(
    isAlertManagerWithConfigAPI({
      implementation: AlertManagerImplementation.mimir,
    })
  ).toBe(true);

  expect(
    isAlertManagerWithConfigAPI({
      implementation: AlertManagerImplementation.prometheus,
    })
  ).toBe(false);
});
