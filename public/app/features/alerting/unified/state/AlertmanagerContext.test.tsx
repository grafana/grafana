import { renderHook } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import * as React from 'react';
import { Provider } from 'react-redux';

import { locationService } from '@grafana/runtime';
import server from '@grafana/test-utils/server';
import store from 'app/core/store';
import { AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';

import * as useAlertManagerSources from '../hooks/useAlertManagerSources';
import { setupMswServer } from '../mockApi';
import { grantUserPermissions } from '../mocks';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY } from '../utils/constants';
import { AlertManagerDataSource, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { AlertmanagerProvider, isAlertManagerWithConfigAPI, useAlertmanager } from './AlertmanagerContext';

jest.mock('app/core/services/context_srv');

const externalAmProm: AlertManagerDataSource = {
  name: 'PrometheusAm',
  imgUrl: '',
};

const externalAmMimir: AlertManagerDataSource = {
  name: 'MimirAm',
  imgUrl: '',
};

setupMswServer();

describe('useAlertmanager', () => {
  beforeEach(() => {
    // Grant basic permissions for testing
    grantUserPermissions([]);

    // Mock the extra configs endpoint to return empty array by default
    server.use(
      http.get('/api/alertmanager/grafana/config/api/v1/alerts', () => {
        return HttpResponse.json({ extra_config: [] });
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('Should return undefined alert manager name when there are no available alert managers', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValue({ availableExternalDataSources: [], availableInternalDataSources: [] });

    const reduxStore = configureStore();
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <Provider store={reduxStore}>
        <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
      </Provider>
    );

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(undefined);
  });

  it('Should return Grafana AM when it is available and no alert manager query param exists', () => {
    jest.spyOn(useAlertManagerSources, 'useAlertManagersByPermission').mockReturnValue({
      availableExternalDataSources: [],
      availableInternalDataSources: [{ name: GRAFANA_RULES_SOURCE_NAME, imgUrl: '', hasConfigurationAPI: true }],
    });

    const reduxStore = configureStore();
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <Provider store={reduxStore}>
        <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
      </Provider>
    );

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(GRAFANA_RULES_SOURCE_NAME);
  });

  it('Should return alert manager included in the query param when available', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValue({ availableExternalDataSources: [externalAmProm], availableInternalDataSources: [] });

    locationService.push({ search: `alertmanager=${externalAmProm.name}` });

    const reduxStore = configureStore();
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <Provider store={reduxStore}>
        <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
      </Provider>
    );

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(externalAmProm.name);
  });

  it('Should return undefined if alert manager included in the query is not available', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValue({ availableExternalDataSources: [], availableInternalDataSources: [] });

    locationService.push({ search: `alertmanager=Not available external AM` });

    const reduxStore = configureStore();
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <Provider store={reduxStore}>
        <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
      </Provider>
    );

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(undefined);
  });

  it('Should return alert manager from store if available and query is empty', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValue({ availableExternalDataSources: [externalAmProm], availableInternalDataSources: [] });

    const reduxStore = configureStore();
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <Provider store={reduxStore}>
        <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
      </Provider>
    );

    store.set(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, externalAmProm.name);
    locationService.push({ search: '' });
    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(externalAmProm.name);
  });

  it('Should prioritize the alert manager from query over store', () => {
    jest.spyOn(useAlertManagerSources, 'useAlertManagersByPermission').mockReturnValue({
      availableExternalDataSources: [externalAmProm, externalAmMimir],
      availableInternalDataSources: [],
    });

    locationService.push({ search: `alertmanager=${externalAmProm.name}` });

    const reduxStore = configureStore();
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <Provider store={reduxStore}>
        <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
      </Provider>
    );

    store.set(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, externalAmMimir.name);

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(externalAmProm.name);
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
