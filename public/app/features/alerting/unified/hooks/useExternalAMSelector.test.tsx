import { renderHook } from '@testing-library/react-hooks';
import { setupServer } from 'msw/node';
import React from 'react';
import { Provider } from 'react-redux';

import 'whatwg-fetch';

import { DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { AlertmanagerChoice, AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';

import { mockDataSource, mockDataSourcesStore, mockStore } from '../mocks';
import { mockAlertmanagerConfigResponse, mockAlertmanagersResponse } from '../mocks/alertmanagerApi';

import { useExternalAmSelector, useExternalDataSourceAlertmanagers } from './useExternalAmSelector';

const server = setupServer();

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getBackendSrv: () => backendSrv,
}));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

describe('useExternalAmSelector', () => {
  it('should have one in pending', async () => {
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [],
        droppedAlertManagers: [],
      },
    });
    mockAlertmanagerConfigResponse(server, {
      alertmanagers: ['some/url/to/am'],
      alertmanagersChoice: AlertmanagerChoice.All,
    });
    const store = mockStore(() => null);

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;
    const { result, waitFor } = renderHook(() => useExternalAmSelector(), { wrapper });
    await waitFor(() => result.current.length > 0);

    const { current: alertmanagers } = result;

    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am',
        status: 'pending',
        actualUrl: '',
      },
    ]);
  });

  it('should have one active, one pending', async () => {
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [{ url: 'some/url/to/am/api/v2/alerts' }],
        droppedAlertManagers: [],
      },
    });
    mockAlertmanagerConfigResponse(server, {
      alertmanagers: ['some/url/to/am', 'some/url/to/am1'],
      alertmanagersChoice: AlertmanagerChoice.All,
    });
    const store = mockStore(() => null);

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;
    const { result, waitFor } = renderHook(() => useExternalAmSelector(), { wrapper });
    await waitFor(() => result.current.length > 0);

    const { current: alertmanagers } = result;

    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am',
        actualUrl: 'some/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'some/url/to/am1',
        actualUrl: '',
        status: 'pending',
      },
    ]);
  });

  it('should have two active', async () => {
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [{ url: 'some/url/to/am/api/v2/alerts' }, { url: 'some/url/to/am1/api/v2/alerts' }],
        droppedAlertManagers: [],
      },
    });
    mockAlertmanagerConfigResponse(server, {
      alertmanagers: ['some/url/to/am', 'some/url/to/am1'],
      alertmanagersChoice: AlertmanagerChoice.All,
    });
    const store = mockStore(() => null);

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;
    const { result, waitFor } = renderHook(() => useExternalAmSelector(), { wrapper });
    await waitFor(() => result.current.length > 0);

    const { current: alertmanagers } = result;

    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am',
        actualUrl: 'some/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'some/url/to/am1',
        actualUrl: 'some/url/to/am1/api/v2/alerts',
        status: 'active',
      },
    ]);
  });

  it('should have one active, one dropped, one pending', async () => {
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [{ url: 'some/url/to/am/api/v2/alerts' }],
        droppedAlertManagers: [{ url: 'some/dropped/url/api/v2/alerts' }],
      },
    });
    mockAlertmanagerConfigResponse(server, {
      alertmanagers: ['some/url/to/am', 'some/url/to/am1'],
      alertmanagersChoice: AlertmanagerChoice.All,
    });
    const store = mockStore(() => null);

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;

    const { result, waitFor } = renderHook(() => useExternalAmSelector(), { wrapper });
    await waitFor(() => result.current.length > 0);

    const { current: alertmanagers } = result;
    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am',
        actualUrl: 'some/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'some/url/to/am1',
        actualUrl: '',
        status: 'pending',
      },
      {
        url: 'some/dropped/url',
        actualUrl: 'some/dropped/url/api/v2/alerts',
        status: 'dropped',
      },
    ]);
  });

  it('The number of alert managers should match config entries when there are multiple entries of the same url', async () => {
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [
          { url: 'same/url/to/am/api/v2/alerts' },
          { url: 'same/url/to/am/api/v2/alerts' },
          { url: 'same/url/to/am/api/v2/alerts' },
        ],
        droppedAlertManagers: [],
      },
    });
    mockAlertmanagerConfigResponse(server, {
      alertmanagers: ['same/url/to/am', 'same/url/to/am', 'same/url/to/am'],
      alertmanagersChoice: AlertmanagerChoice.All,
    });
    const store = mockStore(() => null);

    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;

    const { result, waitFor } = renderHook(() => useExternalAmSelector(), { wrapper });
    await waitFor(() => result.current.length > 0);

    const { current: alertmanagers } = result;

    expect(alertmanagers.length).toBe(3);
    expect(alertmanagers).toEqual([
      {
        url: 'same/url/to/am',
        actualUrl: 'same/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'same/url/to/am',
        actualUrl: 'same/url/to/am/api/v2/alerts',
        status: 'active',
      },
      {
        url: 'same/url/to/am',
        actualUrl: 'same/url/to/am/api/v2/alerts',
        status: 'active',
      },
    ]);
  });
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

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

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

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });
    await waitForNextUpdate();

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

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });
    await waitForNextUpdate();

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

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

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

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });
    await waitForNextUpdate();

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

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

    // Act
    const { result, waitForNextUpdate } = renderHook(() => useExternalDataSourceAlertmanagers(), {
      wrapper,
    });

    await waitForNextUpdate();

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
