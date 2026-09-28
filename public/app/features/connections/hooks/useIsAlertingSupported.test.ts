import { renderHook, waitFor } from '@testing-library/react';

import { PluginType } from '@grafana/data';
import { setDatasourcePluginMetas } from '@grafana/runtime/internal';

import { useIsAlertingSupported } from './useIsAlertingSupported';

function getMockPluginMeta(id: string, alerting?: boolean) {
  return {
    id,
    name: id,
    type: PluginType.datasource,
    alerting,
    info: {
      author: { name: '', url: '' },
      description: '',
      links: [],
      logos: { large: '', small: '' },
      screenshots: [],
      updated: '',
      version: '',
    },
    module: '',
    baseUrl: '',
  };
}

describe('useIsAlertingSupported', () => {
  beforeEach(() => {
    setDatasourcePluginMetas({
      prometheus: getMockPluginMeta('prometheus', true),
      testdata: getMockPluginMeta('testdata', false),
      alertmanager: getMockPluginMeta('alertmanager'),
    });
  });

  afterEach(() => {
    setDatasourcePluginMetas({});
  });

  it('should be loading and not supported while the plugin meta is loading', async () => {
    const { result } = renderHook(() => useIsAlertingSupported('prometheus'));
    expect(result.current).toEqual({ isLoading: true, isSupported: false });
    // let the async meta lookup settle to avoid state updates outside of act()
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('should be loading while the datasource type is not known yet', async () => {
    const { result } = renderHook(() => useIsAlertingSupported(''));
    await waitFor(() => expect(result.current).toEqual({ isLoading: true, isSupported: false }));
  });

  it('should be supported for a datasource with alerting enabled', async () => {
    const { result } = renderHook(() => useIsAlertingSupported('prometheus'));
    await waitFor(() => expect(result.current).toEqual({ isLoading: false, isSupported: true }));
  });

  it('should be supported for the alertmanager datasource', async () => {
    const { result } = renderHook(() => useIsAlertingSupported('alertmanager'));
    await waitFor(() => expect(result.current).toEqual({ isLoading: false, isSupported: true }));
  });

  it('should not be supported for a datasource without alerting support', async () => {
    const { result } = renderHook(() => useIsAlertingSupported('testdata'));
    await waitFor(() => expect(result.current).toEqual({ isLoading: false, isSupported: false }));
  });
});
