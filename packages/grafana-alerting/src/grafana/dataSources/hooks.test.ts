import { act, renderHook, waitFor } from '@testing-library/react';

import { type DataSourceJsonData } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useDataSourceInstanceList } from '@grafana/runtime/unstable';

import {
  useDataSourcesManagingAlertsByUid,
  useDataSourcesWithValidRecordingTarget,
  useDataSourcesWithValidRecordingTargetByUid,
  useRulesSourceDataSources,
} from './hooks';
import { DataSourceInstanceSettingsFactory, setupDataSources } from './testSetup/DataSources';

jest.mock('@grafana/runtime/unstable', () => {
  const actual = jest.requireActual('@grafana/runtime/unstable');
  return {
    ...actual,
    useDataSourceInstanceList: jest.fn(actual.useDataSourceInstanceList),
  };
});

const runtime = jest.requireActual('@grafana/runtime/unstable');
const hookMock = jest.mocked(useDataSourceInstanceList);

function dataSource(uid: string, type = 'prometheus', jsonData: DataSourceJsonData = {}) {
  return DataSourceInstanceSettingsFactory.build({ uid, name: uid, type, jsonData });
}

afterEach(() => {
  jest.clearAllMocks();
  hookMock.mockImplementation(runtime.useDataSourceInstanceList);
});

describe('useDataSourcesWithValidRecordingTarget', () => {
  it('reports loading with no items, then the valid targets', async () => {
    setupDataSources(dataSource('prom'), dataSource('opted-out', 'prometheus', { allowAsRecordingRulesTarget: false }));

    const { result } = renderHook(() => useDataSourcesWithValidRecordingTarget());

    expect(result.current).toEqual({ items: [], isLoading: true, error: undefined });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((ds) => ds.uid)).toEqual(['prom']);
    expect(result.current.error).toBeUndefined();
  });

  it('exposes the error when discovery fails', async () => {
    hookMock.mockReturnValue({ items: [], isLoading: false, error: new Error('list request failed') });

    const { result } = renderHook(() => useDataSourcesWithValidRecordingTarget());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toEqual(new Error('list request failed'));
  });
});

describe('useDataSourcesWithValidRecordingTargetByUid', () => {
  it('keys the valid targets by uid', async () => {
    setupDataSources(dataSource('prom'), dataSource('opted-out', 'prometheus', { allowAsRecordingRulesTarget: false }));

    const { result } = renderHook(() => useDataSourcesWithValidRecordingTargetByUid());

    expect(result.current.byUid.size).toBe(0);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect([...result.current.byUid.keys()]).toEqual(['prom']);
    expect(result.current.byUid.get('prom')?.name).toBe('prom');
  });

  it('keeps the same result object across re-renders', async () => {
    setupDataSources(dataSource('prom'));

    const { result, rerender } = renderHook(() => useDataSourcesWithValidRecordingTargetByUid());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

describe('useDataSourcesManagingAlertsByUid', () => {
  it('reports loading with no items, then keys the data sources that manage alerts by uid', async () => {
    setupDataSources(dataSource('prom'), dataSource('not-managing', 'prometheus', { manageAlerts: false }));

    const { result } = renderHook(() => useDataSourcesManagingAlertsByUid());

    expect(result.current.byUid.size).toBe(0);
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect([...result.current.byUid.keys()]).toEqual(['prom']);
    expect(result.current.error).toBeUndefined();
  });

  it('exposes the error when discovery fails', async () => {
    hookMock.mockReturnValue({ items: [], isLoading: false, error: new Error('list request failed') });

    const { result } = renderHook(() => useDataSourcesManagingAlertsByUid());

    expect(result.current.byUid.size).toBe(0);
    expect(result.current.error).toEqual(new Error('list request failed'));
  });

  it('keeps the same result object across re-renders', async () => {
    setupDataSources(dataSource('prom'));

    const { result, rerender } = renderHook(() => useDataSourcesManagingAlertsByUid());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });
});

describe('useRulesSourceDataSources', () => {
  const grafanaBuiltIn = DataSourceInstanceSettingsFactory.build({
    uid: 'grafana',
    name: '-- Grafana --',
    type: 'grafana',
    meta: { ...DataSourceInstanceSettingsFactory.build().meta, id: 'grafana', builtIn: true },
  });
  const originalToggle = config.defaultDatasourceManageAlertsUiToggle;

  afterEach(() => {
    config.defaultDatasourceManageAlertsUiToggle = originalToggle;
  });

  it('returns every data source of a supported rules source type, and no other type', async () => {
    setupDataSources(
      dataSource('prom'),
      dataSource('loki', 'loki'),
      dataSource('amazon', 'grafana-amazonprometheus-datasource'),
      dataSource('azure', 'grafana-azureprometheus-datasource'),
      dataSource('graphite', 'graphite'),
      dataSource('am', 'alertmanager'),
      grafanaBuiltIn
    );

    const { result } = renderHook(() => useRulesSourceDataSources());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((ds) => ds.uid).sort()).toEqual(['amazon', 'azure', 'loki', 'prom']);
  });

  it('lists every instance of the supported types, not only those with query capabilities', async () => {
    setupDataSources(dataSource('prom'));

    const { result } = renderHook(() => useRulesSourceDataSources());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(hookMock).toHaveBeenCalledWith({
      type: ['loki', 'prometheus', 'grafana-amazonprometheus-datasource', 'grafana-azureprometheus-datasource'],
      all: true,
    });
  });

  it('keeps the data sources that do not manage alerts or allow recording rules, and reports both flags', async () => {
    config.defaultDatasourceManageAlertsUiToggle = true;
    setupDataSources(
      dataSource('unset'),
      dataSource('not-managing', 'prometheus', { manageAlerts: false }),
      dataSource('no-recording', 'loki', { allowAsRecordingRulesTarget: false })
    );

    const { result } = renderHook(() => useRulesSourceDataSources());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toHaveLength(3);
    expect(result.current.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ uid: 'unset', managesAlerts: true, allowedAsRecordingRuleTarget: true }),
        expect.objectContaining({ uid: 'not-managing', managesAlerts: false, allowedAsRecordingRuleTarget: true }),
        expect.objectContaining({ uid: 'no-recording', managesAlerts: true, allowedAsRecordingRuleTarget: false }),
      ])
    );
  });

  it('drops a listed data source without settings instead of judging it on the flag defaults', async () => {
    setupDataSources(dataSource('healthy'), dataSource('without-settings'));
    // eslint-disable-next-line @grafana/no-config-datasources
    delete config.datasources['without-settings'];

    const { result } = renderHook(() => useRulesSourceDataSources());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.map((ds) => ds.uid)).toEqual(['healthy']);
  });

  it('exposes the error when discovery fails', async () => {
    hookMock.mockReturnValue({ items: [], isLoading: false, error: new Error('list request failed') });

    const { result } = renderHook(() => useRulesSourceDataSources());

    expect(result.current).toEqual({ items: [], isLoading: false, error: new Error('list request failed') });
  });

  it('refreshes when the data source cache changes', async () => {
    setupDataSources(dataSource('prom'));
    const { result } = renderHook(() => useRulesSourceDataSources());
    await waitFor(() => expect(result.current.items.map((ds) => ds.uid)).toEqual(['prom']));

    act(() => setupDataSources(dataSource('prom'), dataSource('loki', 'loki')));

    await waitFor(() => expect(result.current.items.map((ds) => ds.uid).sort()).toEqual(['loki', 'prom']));
  });
});
