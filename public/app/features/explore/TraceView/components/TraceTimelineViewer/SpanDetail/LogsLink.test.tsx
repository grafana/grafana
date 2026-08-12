import { of, throwError } from 'rxjs';
import { act, render, screen, userEvent, waitFor } from 'test/test-utils';

import {
  type DataSourceApi,
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type LinkModel,
  store,
  toDataFrame,
} from '@grafana/data';
import {
  getDataSourceInstance,
  useDataSourceInstanceList,
  useDataSourceInstanceSettings,
} from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  getLogsButtonCTA,
  getLogsButtonTooltip,
  lokiDatasourceMatchStorageKey,
  lokiQueryMatchStorageKey,
  LogsLinkButton,
  LogsLinkMenuItem,
} from './LogsLink';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
  useDataSourceInstanceSettings: jest.fn().mockReturnValue({ isLoading: false, settings: undefined }),
  useDataSourceInstanceList: jest.fn().mockReturnValue({ isLoading: false, items: [] }),
}));

const getDataSourceInstanceMock = jest.mocked(getDataSourceInstance);
const useDataSourceInstanceSettingsMock = jest.mocked(useDataSourceInstanceSettings);
const useDataSourceInstanceListMock = jest.mocked(useDataSourceInstanceList);

const DYNAMIC_TRACE_TO_LOGS_FLAG = 'grafana.dynamicTraceToLogs';

const CTA_RELATED_LOGS = 'Related logs';

const TRACE_DATASOURCE_UID = 'trace-ds-uid';

function createLinkModel(overrides: Partial<LinkModel> = {}): LinkModel {
  return {
    href: '/logs',
    title: CTA_RELATED_LOGS,
    target: '_blank',
    origin: {},
    ...overrides,
  };
}

/**
 * Builds a fake datasource whose `query` emits a single response containing the
 * given frames, so the presence check can resolve deterministically.
 */
function mockDatasourceReturningFrames(frames: Array<ReturnType<typeof toDataFrame>>, type: string) {
  const query = jest.fn().mockReturnValue(of({ data: frames }));
  getDataSourceInstanceMock.mockResolvedValue({ query, type } as unknown as DataSourceApi);
  return query;
}

const logsFrame = toDataFrame({
  meta: { preferredVisualisationType: 'logs' },
  fields: [
    { name: 'time', values: [1] },
    { name: 'message', values: ['hello'] },
  ],
});

const emptyFrame = toDataFrame({ fields: [{ name: 'time', values: [] }] });

function queryMatchKey(logsDatasourceUid: string) {
  return lokiQueryMatchStorageKey(TRACE_DATASOURCE_UID, logsDatasourceUid);
}

function datasourceMatchKey() {
  return lokiDatasourceMatchStorageKey(TRACE_DATASOURCE_UID);
}

function mockLokiDatasourceList(uids: string[], isLoading = false) {
  useDataSourceInstanceListMock.mockReturnValue({
    isLoading,
    items: uids.map((uid) => ({ uid, type: 'loki', name: uid }) as DataSourceInstanceListItem),
  });
}

describe('LogsLinkButton', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    store.delete(queryMatchKey('logs-ds-uid'));
    store.delete(queryMatchKey('loki-fallback-uid'));
    store.delete(datasourceMatchKey());
    mockLokiDatasourceList(['logs-ds-uid']);
    useDataSourceInstanceSettingsMock.mockReturnValue({ isLoading: false, settings: undefined });
    // The presence check is gated behind this flag; enable it so most tests exercise the check.
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state updates.
    await act(async () => {
      setTestFlags({ [DYNAMIC_TRACE_TO_LOGS_FLAG]: true });
    });
  });

  afterEach(async () => {
    store.delete(queryMatchKey('logs-ds-uid'));
    store.delete(queryMatchKey('loki-fallback-uid'));
    store.delete(datasourceMatchKey());
    await act(async () => {
      setTestFlags({});
    });
  });

  it('renders the link button with its CTA copy', () => {
    render(<LogsLinkButton linkModel={createLinkModel()} traceDatasourceUid={TRACE_DATASOURCE_UID} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText(CTA_RELATED_LOGS)).toBeInTheDocument();
  });

  it('does not query the datasource when the link has no query', () => {
    render(<LogsLinkButton linkModel={createLinkModel()} traceDatasourceUid={TRACE_DATASOURCE_UID} />);

    expect(getDataSourceInstanceMock).not.toHaveBeenCalled();
  });

  it('does not check for logs when the dynamicTraceToLogs flag is disabled', async () => {
    await act(async () => {
      setTestFlags({ [DYNAMIC_TRACE_TO_LOGS_FLAG]: false });
    });
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    mockDatasourceReturningFrames([emptyFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    // The datasource is never queried, and the button stays enabled (present).
    expect(getDataSourceInstanceMock).not.toHaveBeenCalled();
    await userEvent.hover(await screen.findByRole('button'));
    expect(await screen.findByText('View related logs using the trace data source configuration.')).toBeInTheDocument();
    expect(
      screen.queryByText('No related logs found using the trace data source configuration.')
    ).not.toBeInTheDocument();
  });

  it('runs the query against its datasource to check for logs', async () => {
    const query = mockDatasourceReturningFrames([logsFrame], 'elasticsearch');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'elasticsearch' } };

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(getDataSourceInstanceMock).toHaveBeenCalledWith(interpolatedQuery.datasource));
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ targets: [interpolatedQuery] }));
  });

  it('limits the presence check to a single log line for loki datasources', async () => {
    const query = mockDatasourceReturningFrames([logsFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalled());
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ targets: [expect.objectContaining({ ...interpolatedQuery, maxLines: 1 })] })
    );
  });

  it('does not set maxLines for non-loki logging datasources', async () => {
    const query = mockDatasourceReturningFrames([logsFrame], 'elasticsearch');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'elasticsearch' } };

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalled());
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ targets: [interpolatedQuery] }));
    expect(query).not.toHaveBeenCalledWith(
      expect.objectContaining({ targets: [expect.objectContaining({ maxLines: expect.anything() })] })
    );
  });

  it('marks the button as absent (no logs) when the query returns no rows', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    mockDatasourceReturningFrames([emptyFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await userEvent.hover(await screen.findByRole('button'));
    expect(
      await screen.findByText('No related logs found using the trace data source configuration.')
    ).toBeInTheDocument();
  });

  it('keeps the button as present when the query returns logs', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    mockDatasourceReturningFrames([logsFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(getDataSourceInstanceMock).toHaveBeenCalled());
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByText('View related logs using the trace data source configuration.')).toBeInTheDocument();
  });

  it('keeps the link disabled when the presence check errors', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    const query = jest.fn().mockReturnValue(throwError(() => new Error('boom')));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDataSourceInstanceMock.mockResolvedValue({ query } as any);
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true'));
    await userEvent.hover(screen.getByRole('button'));
    expect(
      await screen.findByText('No related logs found using the trace data source configuration.')
    ).toBeInTheDocument();
  });

  it('keeps the link disabled until a query variation resolves', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    let resolveQuery: ((value: { data: (typeof logsFrame)[] }) => void) | undefined;
    const query = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveQuery = resolve;
      })
    );
    getDataSourceInstanceMock.mockResolvedValue({ query, type: 'loki' } as unknown as DataSourceApi);
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalled());
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');

    await act(async () => {
      resolveQuery?.({ data: [logsFrame] });
    });

    await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'false'));
  });

  it('probes loki query variations until one returns logs and stores the match', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    const query = jest
      .fn()
      .mockReturnValueOnce(of({ data: [emptyFrame] }))
      .mockReturnValueOnce(of({ data: [emptyFrame] }))
      .mockReturnValueOnce(of({ data: [logsFrame] }));
    getDataSourceInstanceMock.mockResolvedValue({ query, type: 'loki' } as unknown as DataSourceApi);

    const queries: DataQuery[] = [
      { refId: 't2l:default:traceID:spanID', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:default:trace_id:span_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:job:trace_id:span_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 'line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalledTimes(3));
    expect(store.get(queryMatchKey('logs-ds-uid'))).toBe('t2l:job:trace_id:span_id');
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByText('View related logs using the trace data source configuration.')).toBeInTheDocument();
  });

  it('uses a stored loki query match immediately without probing other variations', async () => {
    store.set(queryMatchKey('logs-ds-uid'), 't2l:job:trace_id:span_id');
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    const query = mockDatasourceReturningFrames([logsFrame], 'loki');

    const queries: DataQuery[] = [
      { refId: 't2l:default:traceID:spanID', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:job:trace_id:span_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 'line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [expect.objectContaining({ refId: 't2l:job:trace_id:span_id', maxLines: 1 })],
      })
    );
  });

  it('marks the button absent when every loki query variation returns no rows', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    const query = mockDatasourceReturningFrames([emptyFrame], 'loki');
    const queries: DataQuery[] = [
      { refId: 't2l:default:traceID:spanID', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 'line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
    expect(store.get(queryMatchKey('logs-ds-uid'))).toBeUndefined();
    await userEvent.hover(await screen.findByRole('button'));
    expect(
      await screen.findByText('No related logs found using the trace data source configuration.')
    ).toBeInTheDocument();
  });

  it('falls back to other loki datasources when the configured one has no logs and stores the match', async () => {
    mockLokiDatasourceList(['logs-ds-uid', 'loki-fallback-uid', 'loki-other-uid']);
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });

    const primaryQuery = jest.fn().mockReturnValue(of({ data: [emptyFrame] }));
    const fallbackQuery = jest.fn().mockReturnValue(of({ data: [logsFrame] }));
    getDataSourceInstanceMock.mockImplementation(async (ref) => {
      const uid = typeof ref === 'object' && ref && 'uid' in ref ? ref.uid : undefined;
      if (uid === 'loki-fallback-uid') {
        return { query: fallbackQuery, type: 'loki' } as unknown as DataSourceApi;
      }
      return { query: primaryQuery, type: 'loki' } as unknown as DataSourceApi;
    });

    const queries: DataQuery[] = [
      { refId: 't2l:default:trace_id:span_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 'line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(fallbackQuery).toHaveBeenCalled());
    expect(store.get(datasourceMatchKey())).toBe('loki-fallback-uid');
    expect(store.get(queryMatchKey('loki-fallback-uid'))).toBe('t2l:default:trace_id:span_id');
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByText('View related logs using the trace data source configuration.')).toBeInTheDocument();
  });

  it('uses a stored loki datasource match immediately before probing the configured datasource', async () => {
    store.set(datasourceMatchKey(), 'loki-fallback-uid');
    store.set(queryMatchKey('loki-fallback-uid'), 'line-contains');
    mockLokiDatasourceList(['logs-ds-uid', 'loki-fallback-uid']);
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });

    const primaryQuery = jest.fn().mockReturnValue(of({ data: [emptyFrame] }));
    const fallbackQuery = jest.fn().mockReturnValue(of({ data: [logsFrame] }));
    getDataSourceInstanceMock.mockImplementation(async (ref) => {
      const uid = typeof ref === 'object' && ref && 'uid' in ref ? ref.uid : undefined;
      if (uid === 'loki-fallback-uid') {
        return { query: fallbackQuery, type: 'loki' } as unknown as DataSourceApi;
      }
      return { query: primaryQuery, type: 'loki' } as unknown as DataSourceApi;
    });

    const queries: DataQuery[] = [
      { refId: 't2l:default:trace_id:span_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 'line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(fallbackQuery).toHaveBeenCalledTimes(1));
    expect(primaryQuery).not.toHaveBeenCalled();
    expect(fallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          expect.objectContaining({
            refId: 'line-contains',
            datasource: expect.objectContaining({ uid: 'loki-fallback-uid' }),
          }),
        ],
      })
    );
  });
});

describe('LogsLinkMenuItem', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    store.delete(queryMatchKey('logs-ds-uid'));
    store.delete(datasourceMatchKey());
    mockLokiDatasourceList(['logs-ds-uid']);
    useDataSourceInstanceSettingsMock.mockReturnValue({ isLoading: false, settings: undefined });
    // The presence check is gated behind this flag; enable it so most tests exercise the check.
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state updates.
    await act(async () => {
      setTestFlags({ [DYNAMIC_TRACE_TO_LOGS_FLAG]: true });
    });
  });

  afterEach(async () => {
    store.delete(queryMatchKey('logs-ds-uid'));
    store.delete(datasourceMatchKey());
    await act(async () => {
      setTestFlags({});
    });
  });

  it('renders the menu item with its CTA copy', () => {
    render(<LogsLinkMenuItem linkModel={createLinkModel()} traceDatasourceUid={TRACE_DATASOURCE_UID} />);

    expect(screen.getByRole('menuitem')).toBeInTheDocument();
    expect(screen.getByText(CTA_RELATED_LOGS)).toBeInTheDocument();
  });

  it('does not query the datasource when the link has no query', () => {
    render(<LogsLinkMenuItem linkModel={createLinkModel()} traceDatasourceUid={TRACE_DATASOURCE_UID} />);

    expect(getDataSourceInstanceMock).not.toHaveBeenCalled();
  });

  it('does not check for logs when the dynamicTraceToLogs flag is disabled', async () => {
    await act(async () => {
      setTestFlags({ [DYNAMIC_TRACE_TO_LOGS_FLAG]: false });
    });
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    mockDatasourceReturningFrames([emptyFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkMenuItem
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    // The datasource is never queried, and the item stays enabled (present).
    expect(getDataSourceInstanceMock).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem')).toBeEnabled();
  });

  it('runs the query against its datasource to check for logs', async () => {
    const query = mockDatasourceReturningFrames([logsFrame], 'elasticsearch');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'elasticsearch' } };

    render(
      <LogsLinkMenuItem
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(getDataSourceInstanceMock).toHaveBeenCalledWith(interpolatedQuery.datasource));
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ targets: [interpolatedQuery] }));
  });

  it('disables the item when the query returns no rows', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    mockDatasourceReturningFrames([emptyFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkMenuItem
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(screen.getByRole('menuitem')).toBeDisabled());
  });

  it('keeps the item enabled when the query returns logs', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    mockDatasourceReturningFrames([logsFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkMenuItem
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(getDataSourceInstanceMock).toHaveBeenCalled());
    expect(screen.getByRole('menuitem')).toBeEnabled();
  });

  it('keeps the item disabled when the presence check errors', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    const query = jest.fn().mockReturnValue(throwError(() => new Error('boom')));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getDataSourceInstanceMock.mockResolvedValue({ query } as any);
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkMenuItem
        linkModel={createLinkModel({ interpolatedParams: { query: interpolatedQuery } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('menuitem')).toBeDisabled());
  });

  it('invokes the link onClick handler when clicked', async () => {
    const onClick = jest.fn();
    render(<LogsLinkMenuItem linkModel={createLinkModel({ onClick })} traceDatasourceUid={TRACE_DATASOURCE_UID} />);

    await userEvent.click(screen.getByRole('menuitem'));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('getLogsButtonCTA', () => {
  it.each([
    {
      name: 'shows "Related logs" when the datasource has no settings',
      settings: undefined,
      expected: 'Related logs',
    },
    {
      name: 'shows "Related logs" when neither filterBySpanID nor filterByTraceID is set',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false } } },
      expected: 'Related logs',
    },
    {
      name: 'shows "Logs for this trace" when filterByTraceID is set',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterByTraceID: true } } },
      expected: 'Logs for this trace',
    },
    {
      name: 'shows "Logs for this span" when filterBySpanID is set',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterBySpanID: true } } },
      expected: 'Logs for this span',
    },
    {
      name: 'prefers "Logs for this span" when both filters are set',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterBySpanID: true, filterByTraceID: true } } },
      expected: 'Logs for this span',
    },
  ])('$name', ({ settings, expected }) => {
    expect(getLogsButtonCTA(settings as DataSourceInstanceSettings | undefined)).toBe(expected);
  });
});

describe('getLogsButtonTooltip', () => {
  it('returns the generic tooltip when there are no settings, regardless of presence', () => {
    expect(getLogsButtonTooltip(undefined, 'present')).toBe(
      'View related logs using the trace data source configuration.'
    );
    expect(getLogsButtonTooltip(undefined, 'absent')).toBe(
      'View related logs using the trace data source configuration.'
    );
  });

  it.each([
    {
      name: 'span filter, logs present',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterBySpanID: true } } },
      presence: 'present' as const,
      expected: 'See logs related to this span using the trace data source configuration.',
    },
    {
      name: 'span filter, logs absent',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterBySpanID: true } } },
      presence: 'absent' as const,
      expected: 'No logs found for this span using the trace data source configuration.',
    },
    {
      name: 'trace filter, logs present',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterByTraceID: true } } },
      presence: 'present' as const,
      expected: 'See logs related to this trace using the trace data source configuration.',
    },
    {
      name: 'trace filter, logs absent',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterByTraceID: true } } },
      presence: 'absent' as const,
      expected: 'No logs found for this trace using the trace data source configuration.',
    },
    {
      name: 'no filter, logs absent',
      settings: { jsonData: {} },
      presence: 'absent' as const,
      expected: 'No related logs found using the trace data source configuration.',
    },
    {
      name: 'no filter, logs present',
      settings: { jsonData: {} },
      presence: 'present' as const,
      expected: 'View related logs using the trace data source configuration.',
    },
  ])('$name', ({ settings, presence, expected }) => {
    expect(getLogsButtonTooltip(settings as DataSourceInstanceSettings, presence)).toBe(expected);
  });
});
