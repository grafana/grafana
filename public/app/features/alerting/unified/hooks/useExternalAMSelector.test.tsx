import { renderHook } from '@testing-library/react-hooks';
import { setupServer } from 'msw/node';
import React from 'react';
import { Provider } from 'react-redux';

import 'whatwg-fetch';

import { DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { config, setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';

import { mockDataSource, mockDataSourcesStore, mockStore } from '../mocks';
import { mockAlertmanagersResponse } from '../mocks/alertmanagerApi';

import { useExternalDataSourceAlertmanagers } from './useExternalAmSelector';

const server = setupServer();

beforeAll(() => {
  setBackendSrv(backendSrv);
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('useExternalDataSourceAlertmanagers', () => {
  it('Should merge data sources information from config and api responses', async () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource({ url: 'http://grafana.com' });

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockDataSourcesStore({
      dataSources: [dsSettings],
    });

    mockAlertmanagersResponse(server, { data: { activeAlertManagers: [], droppedAlertManagers: [] } });

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });
    await waitForNextUpdate();

    // Assert
    const { current } = result;

    expect(current).toHaveLength(1);
    expect(current[0].dataSource.uid).toBe('1');
    expect(current[0].url).toBe('http://grafana.com');
  });

  it('Should have active state if available in the activeAlertManagers', async () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource({ url: 'http://grafana.com' });

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockStore((state) => {
      state.dataSources.dataSources = [dsSettings];
    });

    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [{ url: 'http://grafana.com/api/v2/alerts' }],
        droppedAlertManagers: [],
      },
    });

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;

    // Act
    const { result, waitForValueToChange } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });
    await waitForValueToChange(() => result.current[0].status);

    // Assert
    const { current } = result;

    expect(current).toHaveLength(1);
    expect(current[0].status).toBe('active');
    expect(current[0].statusInconclusive).toBe(false);
  });

  it('Should have dropped state if available in the droppedAlertManagers', async () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource({ url: 'http://grafana.com' });

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockStore((state) => {
      state.dataSources.dataSources = [dsSettings];
    });

    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [],
        droppedAlertManagers: [{ url: 'http://grafana.com/api/v2/alerts' }],
      },
    });

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;

    // Act
    const { result, waitForValueToChange } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });
    await waitForValueToChange(() => result.current[0].status);

    // Assert
    const { current } = result;

    expect(current).toHaveLength(1);
    expect(current[0].status).toBe('dropped');
    expect(current[0].statusInconclusive).toBe(false);
  });

  it('Should have pending state if not available neither in dropped nor in active alertManagers', async () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource();

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockStore((state) => {
      state.dataSources.dataSources = [dsSettings];
    });

    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [],
        droppedAlertManagers: [],
      },
    });

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });
    await waitForNextUpdate();

    // Assert
    const { current } = result;

    expect(current).toHaveLength(1);
    expect(current[0].status).toBe('pending');
    expect(current[0].statusInconclusive).toBe(false);
  });

  it('Should match Alertmanager url when datasource url does not have protocol specified', async () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource({ url: 'localhost:9093' });

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockStore((state) => {
      state.dataSources.dataSources = [dsSettings];
    });

    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [{ url: 'http://localhost:9093/api/v2/alerts' }],
        droppedAlertManagers: [],
      },
    });

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;

    // Act
    const { result, waitForValueToChange } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });
    await waitForValueToChange(() => result.current[0].status);

    // Assert
    const { current } = result;

    expect(current).toHaveLength(1);
    expect(current[0].status).toBe('active');
    expect(current[0].url).toBe('localhost:9093');
  });

  it('Should have inconclusive state when there are many Alertmanagers of the same URL', async () => {
    // Arrange
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [{ url: 'http://grafana.com/api/v2/alerts' }, { url: 'http://grafana.com/api/v2/alerts' }],
        droppedAlertManagers: [],
      },
    });

    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource({ url: 'http://grafana.com' });

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockStore((state) => {
      state.dataSources.dataSources = [dsSettings];
    });

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;

    // Act
    const { result, waitForValueToChange } = renderHook(() => useExternalDataSourceAlertmanagers(), {
      wrapper,
    });

    await waitForValueToChange(() => result.current[0].status);

    // Assert
    expect(result.current).toHaveLength(1);
    expect(result.current[0].status).toBe('active');
    expect(result.current[0].statusInconclusive).toBe(true);
  });
});

function setupAlertmanagerDataSource(partialDsSettings?: Partial<DataSourceSettings<AlertManagerDataSourceJsonData>>) {
  const dsCommonConfig = {
    uid: '1',
    name: 'External Alertmanager',
    type: 'alertmanager',
    jsonData: { handleGrafanaManagedAlerts: true } as AlertManagerDataSourceJsonData,
  };

  const dsInstanceSettings = mockDataSource(dsCommonConfig);

  const dsSettings = mockApiDataSource({
    ...dsCommonConfig,
    ...partialDsSettings,
  });

  return { dsSettings, dsInstanceSettings };
}

function mockApiDataSource(partial: Partial<DataSourceSettings<DataSourceJsonData, {}>> = {}) {
  const dsSettings: DataSourceSettings<DataSourceJsonData, {}> = {
    uid: '1',
    id: 1,
    name: '',
    url: '',
    type: '',
    access: '',
    orgId: 1,
    typeLogoUrl: '',
    typeName: '',
    user: '',
    database: '',
    basicAuth: false,
    isDefault: false,
    basicAuthUser: '',
    jsonData: { handleGrafanaManagedAlerts: true } as AlertManagerDataSourceJsonData,
    secureJsonFields: {},
    readOnly: false,
    withCredentials: false,
    ...partial,
  };

  return dsSettings;
}
