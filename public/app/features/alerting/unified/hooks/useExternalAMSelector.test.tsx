import { renderHook } from '@testing-library/react-hooks';
import React from 'react';
import { Provider } from 'react-redux';

import { DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { AlertmanagerChoice, AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';

import { mockDataSource, mockDataSourcesStore, mockStore } from '../mocks';

import { useExternalAmSelector, useExternalDataSourceAlertmanagers } from './useExternalAmSelector';

describe('useExternalAmSelector', () => {
  it('should have one in pending', () => {
    const store = createMockStoreState([], [], ['some/url/to/am']);
    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(() => useExternalAmSelector(), { wrapper });
    const alertmanagers = result.current;

    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am',
        status: 'pending',
        actualUrl: '',
      },
    ]);
  });

  it('should have one active, one pending', () => {
    const store = createMockStoreState(
      [{ url: 'some/url/to/am/api/v2/alerts' }],
      [],
      ['some/url/to/am', 'some/url/to/am1']
    );
    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(() => useExternalAmSelector(), { wrapper });
    const alertmanagers = result.current;

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

  it('should have two active', () => {
    const store = createMockStoreState(
      [{ url: 'some/url/to/am/api/v2/alerts' }, { url: 'some/url/to/am1/api/v2/alerts' }],
      [],
      ['some/url/to/am', 'some/url/to/am1']
    );
    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;
    const { result } = renderHook(() => useExternalAmSelector(), { wrapper });
    const alertmanagers = result.current;

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

  it('should have one active, one dropped, one pending', () => {
    const store = createMockStoreState(
      [{ url: 'some/url/to/am/api/v2/alerts' }],
      [{ url: 'some/dropped/url/api/v2/alerts' }],
      ['some/url/to/am', 'some/url/to/am1']
    );
    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;

    const { result } = renderHook(() => useExternalAmSelector(), { wrapper });
    const alertmanagers = result.current;
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

  it('The number of alert managers should match config entries when there are multiple entries of the same url', () => {
    const store = createMockStoreState(
      [
        { url: 'same/url/to/am/api/v2/alerts' },
        { url: 'same/url/to/am/api/v2/alerts' },
        { url: 'same/url/to/am/api/v2/alerts' },
      ],
      [],
      ['same/url/to/am', 'same/url/to/am', 'same/url/to/am']
    );
    const wrapper = ({ children }: React.PropsWithChildren<{}>) => <Provider store={store}>{children}</Provider>;

    const { result } = renderHook(() => useExternalAmSelector(), { wrapper });
    const alertmanagers = result.current;

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
  it('Should merge data sources information from config and api responses', () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource({ url: 'http://grafana.com' });

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockDataSourcesStore({
      dataSources: [dsSettings],
    });

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

    // Act
    const {
      result: { current },
    } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });

    // Assert
    expect(current).toHaveLength(1);
    expect(current[0].dataSource.uid).toBe('1');
    expect(current[0].url).toBe('http://grafana.com');
  });

  it('Should have active state if available in the activeAlertManagers', () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource({ url: 'http://grafana.com' });

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockStore((state) => {
      state.dataSources.dataSources = [dsSettings];
      state.unifiedAlerting.externalAlertmanagers.discoveredAlertmanagers.result = {
        data: {
          activeAlertManagers: [{ url: 'http://grafana.com/api/v2/alerts' }],
          droppedAlertManagers: [],
        },
      };
    });

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

    // Act
    const {
      result: { current },
    } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });

    // Assert
    expect(current).toHaveLength(1);
    expect(current[0].status).toBe('active');
    expect(current[0].statusInconclusive).toBe(false);
  });

  it('Should have dropped state if available in the droppedAlertManagers', () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource({ url: 'http://grafana.com' });

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockStore((state) => {
      state.dataSources.dataSources = [dsSettings];
      state.unifiedAlerting.externalAlertmanagers.discoveredAlertmanagers.result = {
        data: {
          activeAlertManagers: [],
          droppedAlertManagers: [{ url: 'http://grafana.com/api/v2/alerts' }],
        },
      };
    });

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

    // Act
    const {
      result: { current },
    } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });

    // Assert
    expect(current).toHaveLength(1);
    expect(current[0].status).toBe('dropped');
    expect(current[0].statusInconclusive).toBe(false);
  });

  it('Should have pending state if not available neither in dropped nor in active alertManagers', () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource();

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockStore((state) => {
      state.dataSources.dataSources = [dsSettings];
      state.unifiedAlerting.externalAlertmanagers.discoveredAlertmanagers.result = {
        data: {
          activeAlertManagers: [],
          droppedAlertManagers: [],
        },
      };
    });

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

    // Act
    const {
      result: { current },
    } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });

    // Assert
    expect(current).toHaveLength(1);
    expect(current[0].status).toBe('pending');
    expect(current[0].statusInconclusive).toBe(false);
  });

  it('Should match Alertmanager url when datasource url does not have protocol specified', () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource({ url: 'localhost:9093' });

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockStore((state) => {
      state.dataSources.dataSources = [dsSettings];
      state.unifiedAlerting.externalAlertmanagers.discoveredAlertmanagers.result = {
        data: {
          activeAlertManagers: [{ url: 'http://localhost:9093/api/v2/alerts' }],
          droppedAlertManagers: [],
        },
      };
    });

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

    // Act
    const {
      result: { current },
    } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });

    // Assert
    expect(current).toHaveLength(1);
    expect(current[0].status).toBe('active');
    expect(current[0].url).toBe('localhost:9093');
  });

  it('Should have inconclusive state when there are many Alertmanagers of the same URL', () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource({ url: 'http://grafana.com' });

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockStore((state) => {
      state.dataSources.dataSources = [dsSettings];
      state.unifiedAlerting.externalAlertmanagers.discoveredAlertmanagers.result = {
        data: {
          activeAlertManagers: [
            { url: 'http://grafana.com/api/v2/alerts' },
            { url: 'http://grafana.com/api/v2/alerts' },
          ],
          droppedAlertManagers: [],
        },
      };
    });

    const wrapper: React.FC = ({ children }) => <Provider store={store}>{children}</Provider>;

    // Act
    const {
      result: { current },
    } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });

    // Assert
    expect(current).toHaveLength(1);
    expect(current[0].status).toBe('active');
    expect(current[0].statusInconclusive).toBe(true);
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

const createMockStoreState = (
  activeAlertmanagers: Array<{ url: string }>,
  droppedAlertmanagers: Array<{ url: string }>,
  alertmanagerConfig: string[]
) => {
  return mockStore((state) => {
    state.unifiedAlerting.externalAlertmanagers.alertmanagerConfig.result = {
      alertmanagers: alertmanagerConfig,
      alertmanagersChoice: AlertmanagerChoice.All,
    };
    state.unifiedAlerting.externalAlertmanagers.discoveredAlertmanagers.result = {
      data: {
        activeAlertManagers: activeAlertmanagers,
        droppedAlertManagers: droppedAlertmanagers,
      },
    };
  });
};
