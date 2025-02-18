import { renderHook } from '@testing-library/react';
import * as React from 'react';

import { locationService } from '@grafana/runtime';
import store from 'app/core/store';
import { AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';

import * as useAlertManagerSources from '../hooks/useAlertManagerSources';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY } from '../utils/constants';
import { AlertManagerDataSource, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { AlertmanagerProvider, isAlertManagerWithConfigAPI, useAlertmanager } from './AlertmanagerContext';

const externalAmProm: AlertManagerDataSource = {
  name: 'PrometheusAm',
  imgUrl: '',
};

const externalAmMimir: AlertManagerDataSource = {
  name: 'MimirAm',
  imgUrl: '',
};

describe('useAlertmanager', () => {
  it('Should return undefined alert manager name when there are no available alert managers', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValueOnce({ availableExternalDataSources: [], availableInternalDataSources: [] });
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
    );

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(undefined);
  });

  it('Should return Grafana AM when it is available and no alert manager query param exists', () => {
    jest.spyOn(useAlertManagerSources, 'useAlertManagersByPermission').mockReturnValueOnce({
      availableExternalDataSources: [],
      availableInternalDataSources: [{ name: GRAFANA_RULES_SOURCE_NAME, imgUrl: '', hasConfigurationAPI: true }],
    });

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
    );

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(GRAFANA_RULES_SOURCE_NAME);
  });

  it('Should return alert manager included in the query param when available', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValueOnce({ availableExternalDataSources: [externalAmProm], availableInternalDataSources: [] });

    locationService.push({ search: `alertmanager=${externalAmProm.name}` });

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
    );

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(externalAmProm.name);
  });

  it('Should return undefined if alert manager included in the query is not available', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValueOnce({ availableExternalDataSources: [], availableInternalDataSources: [] });

    locationService.push({ search: `alertmanager=Not available external AM` });

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
    );

    const { result } = renderHook(() => useAlertmanager(), { wrapper });
    expect(result.current.selectedAlertmanager).toBe(undefined);
  });

  it('Should return alert manager from store if available and query is empty', () => {
    jest
      .spyOn(useAlertManagerSources, 'useAlertManagersByPermission')
      .mockReturnValueOnce({ availableExternalDataSources: [externalAmProm], availableInternalDataSources: [] });

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
    );

    store.set(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, externalAmProm.name);
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

    const wrapper = ({ children }: React.PropsWithChildren) => (
      <AlertmanagerProvider accessType="instance">{children}</AlertmanagerProvider>
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
