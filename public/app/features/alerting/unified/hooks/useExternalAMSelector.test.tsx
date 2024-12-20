import { renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { SetupServer } from 'msw/node';
import { getWrapper } from 'test/test-utils';

import { DataSourceSettings } from '@grafana/data';
import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { AlertManagerDataSourceJsonData } from 'app/plugins/datasource/alertmanager/types';

import { mockAlertmanagersResponse } from '../mocks/alertmanagerApi';

import { normalizeDataSourceURL, useExternalDataSourceAlertmanagers } from './useExternalAmSelector';

const server = setupMswServer();

const wrapper = () => getWrapper({ renderWithRouter: true });

describe('useExternalDataSourceAlertmanagers', () => {
  it('Should get the correct data source settings', async () => {
    // Arrange
    setupAlertmanagerDataSource(server, { url: 'http://grafana.com' });
    mockAlertmanagersResponse(server, { data: { activeAlertManagers: [], droppedAlertManagers: [] } });

    // Act
    const { result } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper: wrapper() });
    await waitFor(() => {
      // Assert
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0].dataSourceSettings.uid).toBe('1');
    expect(result.current[0].dataSourceSettings.url).toBe('http://grafana.com');
  });

  it('Should have uninterested state if data source does not want alerts', async () => {
    // Arrange
    setupAlertmanagerDataSource(server, { url: 'http://grafana.com', jsonData: { handleGrafanaManagedAlerts: false } });
    mockAlertmanagersResponse(server, { data: { activeAlertManagers: [], droppedAlertManagers: [] } });

    // Act
    const { result } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper: wrapper() });
    await waitFor(() => {
      // Assert
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0].status).toBe('uninterested');
  });

  it('Should have active state if available in the activeAlertManagers', async () => {
    // Arrange
    setupAlertmanagerDataSource(server, { url: 'http://grafana.com' });
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [{ url: 'http://grafana.com/api/v2/alerts' }],
        droppedAlertManagers: [],
      },
    });

    // Act
    const { result } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper: wrapper() });
    await waitFor(() => {
      // Assert
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0].status).toBe('active');
  });

  it('Should have dropped state if available in the droppedAlertManagers', async () => {
    // Arrange
    setupAlertmanagerDataSource(server, { url: 'http://grafana.com' });
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [],
        droppedAlertManagers: [{ url: 'http://grafana.com/api/v2/alerts' }],
      },
    });

    // Act
    const { result } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper: wrapper() });

    await waitFor(() => {
      // Assert
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0].status).toBe('dropped');
  });

  it('Should have pending state if not available neither in dropped nor in active alertManagers', async () => {
    // Arrange
    setupAlertmanagerDataSource(server);
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [],
        droppedAlertManagers: [],
      },
    });

    // Act
    const { result } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper: wrapper() });

    await waitFor(() => {
      // Assert
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0].status).toBe('pending');
  });

  it('Should match Alertmanager url when datasource url does not have protocol specified', async () => {
    // Arrange
    setupAlertmanagerDataSource(server, { url: 'localhost:9093' });
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [{ url: 'http://localhost:9093/api/v2/alerts' }],
        droppedAlertManagers: [],
      },
    });

    // Act
    const { result } = renderHook(() => useExternalDataSourceAlertmanagers(), { wrapper: wrapper() });

    await waitFor(() => {
      // Assert
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0].status).toBe('active');
    expect(result.current[0].dataSourceSettings.url).toBe('localhost:9093');
  });

  it('Should have inconclusive state when there are many Alertmanagers of the same URL on both active and inactive', async () => {
    // Arrange
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [{ url: 'http://grafana.com/api/v2/alerts' }],
        droppedAlertManagers: [{ url: 'http://grafana.com/api/v2/alerts' }],
      },
    });

    setupAlertmanagerDataSource(server, { url: 'http://grafana.com' });

    // Act
    const { result } = renderHook(() => useExternalDataSourceAlertmanagers(), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      // Assert
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0].status).toBe('inconclusive');
  });

  it('Should have not have inconclusive state when all Alertmanagers of the same URL are active', async () => {
    // Arrange
    mockAlertmanagersResponse(server, {
      data: {
        activeAlertManagers: [{ url: 'http://grafana.com/api/v2/alerts' }, { url: 'http://grafana.com/api/v2/alerts' }],
        droppedAlertManagers: [],
      },
    });

    setupAlertmanagerDataSource(server, { url: 'http://grafana.com' });

    // Act
    const { result } = renderHook(() => useExternalDataSourceAlertmanagers(), {
      wrapper: wrapper(),
    });

    await waitFor(() => {
      // Assert
      expect(result.current).toHaveLength(1);
    });
    expect(result.current[0].status).toBe('active');
  });
});

describe('normalizeDataSourceURL', () => {
  it('should add "http://" protocol if missing', () => {
    const url = 'example.com';
    const normalizedURL = normalizeDataSourceURL(url);
    expect(normalizedURL).toBe('http://example.com');
  });

  it('should not modify the URL if it already has a protocol', () => {
    const url = 'https://example.com';
    const normalizedURL = normalizeDataSourceURL(url);
    expect(normalizedURL).toBe(url);
  });

  it('should remove trailing slashes from the URL', () => {
    const url = 'http://example.com/';
    const normalizedURL = normalizeDataSourceURL(url);
    expect(normalizedURL).toBe('http://example.com');
  });

  it('should remove multiple trailing slashes from the URL', () => {
    const url = 'http://example.com///';
    const normalizedURL = normalizeDataSourceURL(url);
    expect(normalizedURL).toBe('http://example.com');
  });

  it('should keep paths from the URL', () => {
    const url = 'http://example.com/foo//';
    const normalizedURL = normalizeDataSourceURL(url);
    expect(normalizedURL).toBe('http://example.com/foo');
  });
});

function setupAlertmanagerDataSource(
  server: SetupServer,
  partialDsSettings?: Partial<DataSourceSettings<AlertManagerDataSourceJsonData>>
) {
  const dsCommonConfig = {
    uid: '1',
    name: 'External Alertmanager',
    type: 'alertmanager',
    jsonData: { handleGrafanaManagedAlerts: true },
  };

  const dsSettings = {
    ...dsCommonConfig,
    ...partialDsSettings,
  };

  server.use(
    http.get('/api/datasources', () => {
      return HttpResponse.json([dsSettings]);
    })
  );
}
