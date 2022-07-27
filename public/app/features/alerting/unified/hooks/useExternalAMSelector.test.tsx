import { renderHook } from '@testing-library/react-hooks';
import React from 'react';
import * as reactRedux from 'react-redux';

import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { AlertmanagerChoice, AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';

import { mockDataSource, mockDataSourcesStore, mockStore } from '../mocks';

import { useExternalAmSelector, useExternalDataSourceAlertmanagers } from './useExternalAmSelector';

const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');

describe('useExternalAmSelector', () => {
  beforeEach(() => {
    useSelectorMock.mockClear();
  });
  it('should have one in pending', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(createMockStoreState([], [], ['some/url/to/am']));
    });
    const alertmanagers = useExternalAmSelector();

    expect(alertmanagers).toEqual([
      {
        url: 'some/url/to/am',
        status: 'pending',
        actualUrl: '',
      },
    ]);
  });

  it('should have one active, one pending', () => {
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState([{ url: 'some/url/to/am/api/v2/alerts' }], [], ['some/url/to/am', 'some/url/to/am1'])
      );
    });

    const alertmanagers = useExternalAmSelector();

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
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState(
          [{ url: 'some/url/to/am/api/v2/alerts' }, { url: 'some/url/to/am1/api/v2/alerts' }],
          [],
          ['some/url/to/am', 'some/url/to/am1']
        )
      );
    });

    const alertmanagers = useExternalAmSelector();

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
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState(
          [{ url: 'some/url/to/am/api/v2/alerts' }],
          [{ url: 'some/dropped/url/api/v2/alerts' }],
          ['some/url/to/am', 'some/url/to/am1']
        )
      );
    });

    const alertmanagers = useExternalAmSelector();

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
    useSelectorMock.mockImplementation((callback) => {
      return callback(
        createMockStoreState(
          [
            { url: 'same/url/to/am/api/v2/alerts' },
            { url: 'same/url/to/am/api/v2/alerts' },
            { url: 'same/url/to/am/api/v2/alerts' },
          ],
          [],
          ['same/url/to/am', 'same/url/to/am', 'same/url/to/am']
        )
      );
    });

    const alertmanagers = useExternalAmSelector();

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
  beforeEach(() => {
    useSelectorMock.mockRestore();
  });

  it('Should merge data sources information from config and api responses', () => {
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource();

    config.datasources = {
      'External Alertmanager': dsInstanceSettings,
    };

    const store = mockDataSourcesStore({
      dataSources: [dsSettings],
    });

    const wrapper: React.FC = ({ children }) => <reactRedux.Provider store={store}>{children}</reactRedux.Provider>;

    const { result } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].dataSource.uid).toBe('1');
    expect(result.current[0].url).toBe('http://grafana.com');
  });

  it('Should have ative state if available in the activeAlertManagers', () => {
    // Arrange
    const { dsSettings, dsInstanceSettings } = setupAlertmanagerDataSource();

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

    const wrapper: React.FC = ({ children }) => <reactRedux.Provider store={store}>{children}</reactRedux.Provider>;

    // Act
    const { result } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper });

    // Assert
    expect(result.current).toHaveLength(1);
    expect(result.current[0].dataSource.uid).toBe('1');
    expect(result.current[0].url).toBe('http://grafana.com');
    expect(result.current[0].status).toBe('active');
    expect(result.current[0].statusInconclusive).toBe(false);
  });
});

type CombinedDataSourceSettings = Partial<DataSourceSettings & DataSourceInstanceSettings<DataSourceJsonData>>;

function setupAlertmanagerDataSource(settings?: CombinedDataSourceSettings) {
  const dsConfig = {
    uid: '1',
    name: 'External Alertmanager',
    type: 'alertmanager',
    jsonData: { handleGrafanaManagedAlerts: true } as AlertManagerDataSourceJsonData,
  };

  const dsInstanceSettings = mockDataSource(dsConfig);

  const dsSettings = mockApiDataSource({
    ...dsConfig,
    url: 'http://grafana.com',
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
  return {
    unifiedAlerting: {
      externalAlertmanagers: {
        discoveredAlertmanagers: {
          result: {
            data: {
              activeAlertManagers: activeAlertmanagers,
              droppedAlertManagers: droppedAlertmanagers,
            },
          },
          dispatched: false,
          loading: false,
        },
        alertmanagerConfig: {
          result: {
            alertmanagers: alertmanagerConfig,
            alertmanagersChoice: AlertmanagerChoice.All,
          },
          dispatched: false,
          loading: false,
        },
      },
    },
  };
};
