import { renderHook } from '@testing-library/react-hooks';
import { createMemoryHistory } from 'history';
import React from 'react';
import { MemoryRouter, Router } from 'react-router-dom';

import store from 'app/core/store';

import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY } from '../utils/constants';
import { AlertManagerDataSource, GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { useAlertManagerSourceName } from './useAlertManagerSourceName';

const grafanaAm: AlertManagerDataSource = {
  name: GRAFANA_RULES_SOURCE_NAME,
  imgUrl: '',
};

const externalAmProm: AlertManagerDataSource = {
  name: 'PrometheusAm',
  imgUrl: '',
};

const externalAmMimir: AlertManagerDataSource = {
  name: 'MimirAm',
  imgUrl: '',
};

describe('useAlertManagerSourceName', () => {
  it('Should return undefined alert manager name when there are no available alert managers', () => {
    const wrapper: React.FC = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;
    const { result } = renderHook(() => useAlertManagerSourceName([]), { wrapper });

    const [alertManager] = result.current;

    expect(alertManager).toBeUndefined();
  });

  it('Should return Grafana AM when it is available and no alert manager query param exists', () => {
    const wrapper: React.FC = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

    const availableAMs = [grafanaAm, externalAmProm, externalAmMimir];
    const { result } = renderHook(() => useAlertManagerSourceName(availableAMs), { wrapper });

    const [alertManager] = result.current;

    expect(alertManager).toBe(grafanaAm.name);
  });

  it('Should return alert manager included in the query param when available', () => {
    const history = createMemoryHistory();
    history.push({ search: `alertmanager=${externalAmProm.name}` });
    const wrapper: React.FC = ({ children }) => <Router history={history}>{children}</Router>;

    const availableAMs = [grafanaAm, externalAmProm, externalAmMimir];
    const { result } = renderHook(() => useAlertManagerSourceName(availableAMs), { wrapper });

    const [alertManager] = result.current;

    expect(alertManager).toBe(externalAmProm.name);
  });

  it('Should return undefined if alert manager included in the query is not available', () => {
    const history = createMemoryHistory();
    history.push({ search: `alertmanager=Not available external AM` });
    const wrapper: React.FC = ({ children }) => <Router history={history}>{children}</Router>;

    const availableAMs = [grafanaAm, externalAmProm, externalAmMimir];

    const { result } = renderHook(() => useAlertManagerSourceName(availableAMs), { wrapper });

    const [alertManager] = result.current;

    expect(alertManager).toBe(undefined);
  });

  it('Should return alert manager from store if available and query is empty', () => {
    const wrapper: React.FC = ({ children }) => <MemoryRouter>{children}</MemoryRouter>;

    const availableAMs = [grafanaAm, externalAmProm, externalAmMimir];
    store.set(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, externalAmProm.name);

    const { result } = renderHook(() => useAlertManagerSourceName(availableAMs), { wrapper });

    const [alertManager] = result.current;

    expect(alertManager).toBe(externalAmProm.name);
  });

  it('Should prioritize the alert manager from query over store', () => {
    const history = createMemoryHistory();
    history.push({ search: `alertmanager=${externalAmProm.name}` });
    const wrapper: React.FC = ({ children }) => <Router history={history}>{children}</Router>;

    const availableAMs = [grafanaAm, externalAmProm, externalAmMimir];
    store.set(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, externalAmMimir.name);

    const { result } = renderHook(() => useAlertManagerSourceName(availableAMs), { wrapper });

    const [alertManager] = result.current;

    expect(alertManager).toBe(externalAmProm.name);
  });
});
