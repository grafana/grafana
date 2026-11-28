import { act, renderHook, waitFor } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';
import { type TraceToLogsData } from '@grafana/o11y-ds-frontend';
import { getDataSourceInstanceSettings, logError } from '@grafana/runtime';

import { keepUnchangedSlots, useTraceToLogsDestinations } from './useTraceToLogsDestinations';

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

  it('publishes a resolved destination while another lookup is still pending', async () => {
    jest
      .mocked(getDataSourceInstanceSettings)
      .mockImplementation((ref) =>
        ref === 'loki-audit-uid' ? new Promise(() => {}) : Promise.resolve(settingsByRef[String(ref)])
      );
    const jsonData: TraceToLogsData = {
      tracesToLogsV2: { customQuery: false, datasourceUid: 'loki-app-uid' },
      tracesToLogsAdditional: [{ customQuery: false, datasourceUid: 'loki-audit-uid' }],
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
      ])
    );
  });

  it('does not revive a retired slot while its new lookup is pending', async () => {
    const primary = { customQuery: false, datasourceUid: appLogs.uid };
    const both: TraceToLogsData = {
      tracesToLogsV2: primary,
      tracesToLogsAdditional: [{ customQuery: false, datasourceUid: auditLogs.uid }],
    };
    const { result, rerender } = renderHook((data: TraceToLogsData) => useTraceToLogsDestinations(data), {
      initialProps: both,
    });
    await waitFor(() => expect(result.current.map((d) => d.index)).toEqual([0, 1]));

    const refreshedApp = { ...appLogs, name: 'Renamed app logs' };
    jest.mocked(getDataSourceInstanceSettings).mockResolvedValueOnce(refreshedApp);
    rerender({ tracesToLogsV2: primary });
    await waitFor(() => expect(result.current[0]?.settings).toBe(refreshedApp));

    jest
      .mocked(getDataSourceInstanceSettings)
      .mockImplementation((ref) => (ref === auditLogs.uid ? new Promise(() => {}) : Promise.resolve(refreshedApp)));
    rerender(both);
    // Lets the first destination's new lookup settle; the second one stays pending.
    await act(async () => {});
    expect(result.current.map((d) => d.index)).toEqual([0]);
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

describe('keepUnchangedSlots', () => {
  it('drops a result that a removed slot left behind when the slot is added again', () => {
    const app = { datasourceUid: appLogs.uid, settings: appLogs };
    const lateAudit = { datasourceUid: auditLogs.uid, settings: auditLogs };
    const withoutAudit = [{ customQuery: false, datasourceUid: appLogs.uid }];
    const withAudit = [...withoutAudit, { customQuery: false, datasourceUid: auditLogs.uid }];

    expect(keepUnchangedSlots([app, lateAudit], withoutAudit, withAudit)).toEqual([app, undefined]);
  });
});
