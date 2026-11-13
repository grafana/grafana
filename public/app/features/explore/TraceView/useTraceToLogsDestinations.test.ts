import { renderHook, waitFor } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { type TraceToLogsData } from '@grafana/o11y-ds-frontend';
import { getDataSourceInstanceSettings, logError } from '@grafana/runtime';

import { useTraceToLogsDestinations } from './useTraceToLogsDestinations';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceSettings: jest.fn(),
  logError: jest.fn(),
}));

const appLogs = { uid: 'loki-app-uid', name: 'Application logs', type: 'loki' } as DataSourceInstanceSettings;
const auditLogs = { uid: 'loki-audit-uid', name: 'Audit logs', type: 'loki' } as DataSourceInstanceSettings;

// Like the real lookup, a reference resolves by uid or by data source name.
const settingsByRef: Record<string, DataSourceInstanceSettings> = {
  'loki-app-uid': appLogs,
  'loki-audit-uid': auditLogs,
  'Audit logs': auditLogs,
};

describe('useTraceToLogsDestinations', () => {
  beforeEach(() => {
    jest.mocked(logError).mockReset();
    jest.mocked(getDataSourceInstanceSettings).mockReset();
    jest
      .mocked(getDataSourceInstanceSettings)
      .mockImplementation(async (ref) => (typeof ref === 'string' ? settingsByRef[ref] : undefined));
  });

  it('resolves destinations in configuration order and leaves out the ones without a data source', async () => {
    const jsonData: TraceToLogsData = {
      tracesToLogsV2: { customQuery: false, datasourceUid: 'loki-app-uid' },
      tracesToLogsAdditional: [
        { customQuery: false, datasourceUid: 'deleted-uid' },
        { customQuery: false },
        { customQuery: false, datasourceUid: 'loki-audit-uid' },
      ],
    };

    const { result } = renderHook(() => useTraceToLogsDestinations(jsonData));

    await waitFor(() =>
      expect(result.current).toEqual([
        {
          index: 0,
          options: { customQuery: false, datasourceUid: 'loki-app-uid' },
          settings: appLogs,
          isOneOfMany: true,
        },
        {
          index: 3,
          options: { customQuery: false, datasourceUid: 'loki-audit-uid' },
          settings: auditLogs,
          isOneOfMany: true,
        },
      ])
    );
    // A destination without a data source must not resolve to the default data source.
    expect(getDataSourceInstanceSettings).not.toHaveBeenCalledWith(undefined);
  });

  it('logs a failed lookup and keeps the other destinations', async () => {
    const failure = new Error('failed to load the settings');
    jest.mocked(getDataSourceInstanceSettings).mockImplementation(async (ref) => {
      if (ref === 'loki-app-uid') {
        throw failure;
      }
      return typeof ref === 'string' ? settingsByRef[ref] : undefined;
    });
    const jsonData: TraceToLogsData = {
      tracesToLogsV2: { customQuery: false, datasourceUid: 'loki-app-uid' },
      tracesToLogsAdditional: [{ customQuery: false, datasourceUid: 'loki-audit-uid' }],
    };

    const { result } = renderHook(() => useTraceToLogsDestinations(jsonData));

    await waitFor(() =>
      expect(result.current).toEqual([
        {
          index: 1,
          options: { customQuery: false, datasourceUid: 'loki-audit-uid' },
          settings: auditLogs,
          isOneOfMany: true,
        },
      ])
    );
    expect(logError).toHaveBeenCalledWith(failure, { datasourceUid: 'loki-app-uid' });
  });

  it('keeps a destination whose data source is referenced by name', async () => {
    const jsonData: TraceToLogsData = { tracesToLogsV2: { customQuery: false, datasourceUid: 'Audit logs' } };

    const { result } = renderHook(() => useTraceToLogsDestinations(jsonData));

    await waitFor(() =>
      expect(result.current).toEqual([
        {
          index: 0,
          options: { customQuery: false, datasourceUid: 'Audit logs' },
          settings: auditLogs,
          isOneOfMany: false,
        },
      ])
    );
  });
});
