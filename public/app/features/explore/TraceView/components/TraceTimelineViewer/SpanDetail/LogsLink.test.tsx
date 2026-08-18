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
import { reportInteraction } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import {
  getDataSourceInstance,
  useDataSourceInstanceList,
  useDataSourceInstanceSettings,
} from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type LokiQuery } from 'app/features/loki-helpers/types';

import { getTraceToLogsSpanQuery, getTraceToLogsTraceQuery } from '../../logsLink';
import { type Trace, type TraceSpan } from '../../types/trace';

import {
  addNoSpanIdFallback,
  getLogsButtonCTA,
  getLogsButtonTooltip,
  LOKI_DATASOURCE_MATCH_STORAGE_KEY_PREFIX,
  lokiQueryMatchStorageKey,
  LogsLinkButton,
  LogsLinkMenuItem,
} from './LogsLink';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

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

/** Presence checks run when interpolatedParams.query is set. */
function createProbingLinkModel(query: DataQuery): LinkModel {
  return createLinkModel({
    interpolatedParams: { query },
  });
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
  return `${LOKI_DATASOURCE_MATCH_STORAGE_KEY_PREFIX}.${TRACE_DATASOURCE_UID}`;
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
      <LogsLinkButton linkModel={createProbingLinkModel(interpolatedQuery)} traceDatasourceUid={TRACE_DATASOURCE_UID} />
    );

    // The datasource is never queried, and the button stays enabled (present).
    expect(getDataSourceInstanceMock).not.toHaveBeenCalled();
    expect(reportInteraction).not.toHaveBeenCalled();
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
      <LogsLinkButton linkModel={createProbingLinkModel(interpolatedQuery)} traceDatasourceUid={TRACE_DATASOURCE_UID} />
    );

    await waitFor(() => expect(getDataSourceInstanceMock).toHaveBeenCalledWith(interpolatedQuery.datasource));
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ targets: [interpolatedQuery] }));
  });

  it('limits the presence check to a single log line for loki datasources', async () => {
    const query = mockDatasourceReturningFrames([logsFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton linkModel={createProbingLinkModel(interpolatedQuery)} traceDatasourceUid={TRACE_DATASOURCE_UID} />
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
      <LogsLinkButton linkModel={createProbingLinkModel(interpolatedQuery)} traceDatasourceUid={TRACE_DATASOURCE_UID} />
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
      <LogsLinkButton linkModel={createProbingLinkModel(interpolatedQuery)} traceDatasourceUid={TRACE_DATASOURCE_UID} />
    );

    await userEvent.hover(await screen.findByRole('button'));
    expect(await screen.findByText('No matching logs found for this span')).toBeInTheDocument();
    expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_span_logs_checked', {
      logs: false,
      refId: undefined,
    });
  });

  it('uses the trace-level absent tooltip when forTrace is set', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    mockDatasourceReturningFrames([emptyFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton
        linkModel={createProbingLinkModel(interpolatedQuery)}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
        forTrace
      />
    );

    await userEvent.hover(await screen.findByRole('button'));
    expect(await screen.findByText('No matching logs found for this trace')).toBeInTheDocument();
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
      <LogsLinkButton linkModel={createProbingLinkModel(interpolatedQuery)} traceDatasourceUid={TRACE_DATASOURCE_UID} />
    );

    await waitFor(() => expect(getDataSourceInstanceMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_span_logs_checked', {
        logs: true,
        refId: undefined,
      })
    );
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByText('See related logs')).toBeInTheDocument();
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
      <LogsLinkButton linkModel={createProbingLinkModel(interpolatedQuery)} traceDatasourceUid={TRACE_DATASOURCE_UID} />
    );

    await waitFor(() => expect(query).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true'));
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByText('No matching logs found for this span')).toBeInTheDocument();
  });

  it('keeps the link disabled until a query variation resolves', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    let resolveQuery: ((value: { data: Array<typeof logsFrame> }) => void) | undefined;
    const query = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveQuery = resolve;
      })
    );
    getDataSourceInstanceMock.mockResolvedValue({ query, type: 'loki' } as unknown as DataSourceApi);
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton linkModel={createProbingLinkModel(interpolatedQuery)} traceDatasourceUid={TRACE_DATASOURCE_UID} />
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
      { refId: 't2l:default:traceID', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:default:trace_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:job:trace_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries[0], alternativeQueries: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalledTimes(3));
    expect(store.get(queryMatchKey('logs-ds-uid'))).toBe('t2l:job:trace_id');
    await waitFor(() =>
      expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_span_logs_checked', {
        logs: true,
        refId: 't2l:job:trace_id',
      })
    );
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByText('See related logs')).toBeInTheDocument();
  });

  it('uses a stored loki query match immediately without probing other variations', async () => {
    store.set(queryMatchKey('logs-ds-uid'), 't2l:job:trace_id');
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    const query = mockDatasourceReturningFrames([logsFrame], 'loki');

    const queries: DataQuery[] = [
      { refId: 't2l:default:traceID', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:job:trace_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries[0], alternativeQueries: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [expect.objectContaining({ refId: 't2l:job:trace_id', maxLines: 1 })],
      })
    );
    await waitFor(() =>
      expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_span_logs_checked', {
        logs: true,
        refId: 't2l:job:trace_id',
      })
    );
  });

  it('does not rediscover variants when a stored loki query match returns no logs', async () => {
    store.set(datasourceMatchKey(), 'logs-ds-uid');
    store.set(queryMatchKey('logs-ds-uid'), 't2l:job:trace_id');
    mockLokiDatasourceList(['logs-ds-uid', 'loki-fallback-uid']);
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    const query = mockDatasourceReturningFrames([emptyFrame], 'loki');

    const queries: DataQuery[] = [
      { refId: 't2l:default:traceID', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:job:trace_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries[0], alternativeQueries: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalledTimes(1));
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [expect.objectContaining({ refId: 't2l:job:trace_id', maxLines: 1 })],
      })
    );
    await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true'));
    expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_span_logs_checked', {
      logs: false,
      refId: undefined,
    });
  });

  it('marks the button absent when every loki query variation returns no rows', async () => {
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    const query = mockDatasourceReturningFrames([emptyFrame], 'loki');
    const queries: DataQuery[] = [
      { refId: 't2l:default:traceID', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries[0], alternativeQueries: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
    expect(store.get(queryMatchKey('logs-ds-uid'))).toBeUndefined();
    await waitFor(() =>
      expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_span_logs_checked', {
        logs: false,
        refId: undefined,
      })
    );
    await userEvent.hover(await screen.findByRole('button'));
    expect(await screen.findByText('No matching logs found for this span')).toBeInTheDocument();
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
      { refId: 't2l:default:trace_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries[0], alternativeQueries: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(fallbackQuery).toHaveBeenCalled());
    expect(store.get(datasourceMatchKey())).toBe('loki-fallback-uid');
    expect(store.get(queryMatchKey('loki-fallback-uid'))).toBe('t2l:default:trace_id');
    await waitFor(() =>
      expect(reportInteraction).toHaveBeenCalledWith('grafana_traces_trace_view_span_logs_checked', {
        logs: true,
        refId: 't2l:default:trace_id',
      })
    );
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByText('See related logs')).toBeInTheDocument();
  });

  it('uses a stored loki datasource match immediately before probing the configured datasource', async () => {
    store.set(datasourceMatchKey(), 'loki-fallback-uid');
    store.set(queryMatchKey('loki-fallback-uid'), 't2l:line-contains');
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
      { refId: 't2l:default:trace_id', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
      { refId: 't2l:line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries[0], alternativeQueries: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(fallbackQuery).toHaveBeenCalledTimes(1));
    expect(primaryQuery).not.toHaveBeenCalled();
    expect(fallbackQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        targets: [
          expect.objectContaining({
            refId: 't2l:line-contains',
            datasource: expect.objectContaining({ uid: 'loki-fallback-uid' }),
          }),
        ],
      })
    );
  });

  it('retries a stored match without its span_id filter when the span-scoped query returns no logs', async () => {
    store.set(datasourceMatchKey(), 'logs-ds-uid');
    store.set(queryMatchKey('logs-ds-uid'), 't2l:default:trace_id');
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });

    const withSpanExpr =
      '{cluster="cluster1"} | logfmt | json | drop __error__ | trace_id="7946b05c2e2e4e5a" | span_id="6605c7b08e715d6c"';
    const withoutSpanExpr = '{cluster="cluster1"} | logfmt | json | drop __error__ | trace_id="7946b05c2e2e4e5a"';

    const query = jest
      .fn()
      .mockReturnValueOnce(of({ data: [emptyFrame] }))
      .mockReturnValueOnce(of({ data: [logsFrame] }));
    getDataSourceInstanceMock.mockResolvedValue({ query, type: 'loki' } as unknown as DataSourceApi);

    const queries: DataQuery[] = [
      {
        refId: 't2l:default:trace_id',
        expr: withSpanExpr,
        datasource: { uid: 'logs-ds-uid', type: 'loki' },
      } as DataQuery,
      { refId: 't2l:line-contains', datasource: { uid: 'logs-ds-uid', type: 'loki' } },
    ];

    render(
      <LogsLinkButton
        linkModel={createLinkModel({ interpolatedParams: { query: queries[0], alternativeQueries: queries } })}
        traceDatasourceUid={TRACE_DATASOURCE_UID}
      />
    );

    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        targets: [expect.objectContaining({ expr: withSpanExpr, maxLines: 1 })],
      })
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        targets: [expect.objectContaining({ expr: withoutSpanExpr, maxLines: 1 })],
      })
    );
    await waitFor(() => expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'false'));
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
        linkModel={createProbingLinkModel(interpolatedQuery)}
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
        linkModel={createProbingLinkModel(interpolatedQuery)}
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
        linkModel={createProbingLinkModel(interpolatedQuery)}
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
        linkModel={createProbingLinkModel(interpolatedQuery)}
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
        linkModel={createProbingLinkModel(interpolatedQuery)}
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
  afterEach(() => {
    setTestFlags({});
  });

  it.each([
    {
      name: 'shows "Related logs" when the datasource has no settings',
      settings: undefined,
      type: 'span',
      expected: 'Related logs',
    },
    {
      name: 'shows "Related logs" when neither filterBySpanID nor filterByTraceID is set',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false } } },
      type: 'span',
      expected: 'Related logs',
    },
    {
      name: 'shows "Logs for this trace" when filterByTraceID is set',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterByTraceID: true } } },
      type: 'span',
      expected: 'Logs for this trace',
    },
    {
      name: 'shows "Logs for this span" when filterBySpanID is set',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterBySpanID: true } } },
      type: 'span',
      expected: 'Logs for this span',
    },
    {
      name: 'prefers "Logs for this span" when both filters are set',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterBySpanID: true, filterByTraceID: true } } },
      type: 'span',
      expected: 'Logs for this span',
    },
  ])('$name', ({ settings, type, expected }) => {
    // @ts-expect-error
    expect(getLogsButtonCTA(settings as DataSourceInstanceSettings | undefined, type)).toBe(expected);
  });

  it('uses the link type when dynamic trace-to-logs is enabled, ignoring filter settings', () => {
    setTestFlags({ [FlagKeys.GrafanaDynamicTraceToLogs]: true });
    const settings = {
      jsonData: { tracesToLogsV2: { customQuery: false, filterByTraceID: true } },
    } as unknown as DataSourceInstanceSettings;

    expect(getLogsButtonCTA(settings, 'span')).toBe('Logs for this span');
    expect(getLogsButtonCTA(settings, 'trace')).toBe('Logs for this trace');
  });
});

describe('getLogsButtonTooltip', () => {
  afterEach(() => {
    setTestFlags({});
  });

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
      presence: 'present',
      type: 'span',
      expected: 'See logs related to this span using the trace data source configuration.',
    },
    {
      name: 'span filter, logs absent',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterBySpanID: true } } },
      presence: 'absent',
      type: 'span',
      expected: 'No logs found for this span using the trace data source configuration.',
    },
    {
      name: 'trace filter, logs present',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterByTraceID: true } } },
      presence: 'present',
      type: 'span',
      expected: 'See logs related to this trace using the trace data source configuration.',
    },
    {
      name: 'trace filter, logs absent',
      settings: { jsonData: { tracesToLogsV2: { customQuery: false, filterByTraceID: true } } },
      presence: 'absent',
      type: 'span',
      expected: 'No logs found for this trace using the trace data source configuration.',
    },
    {
      name: 'explicit trace type, logs present',
      settings: { jsonData: {} },
      presence: 'present',
      type: 'trace',
      expected: 'See logs related to this trace using the trace data source configuration.',
    },
    {
      name: 'explicit trace type, logs absent',
      settings: { jsonData: {} },
      presence: 'absent',
      type: 'trace',
      expected: 'No logs found for this trace using the trace data source configuration.',
    },
    {
      name: 'no filter, logs absent',
      settings: { jsonData: {} },
      presence: 'absent',
      type: 'span',
      expected: 'No related logs found using the trace data source configuration.',
    },
    {
      name: 'no filter, logs present',
      settings: { jsonData: {} },
      presence: 'present',
      type: 'span',
      expected: 'View related logs using the trace data source configuration.',
    },
  ])('$name', ({ settings, presence, type, expected }) => {
    // @ts-expect-error
    expect(getLogsButtonTooltip(settings as DataSourceInstanceSettings, presence, type)).toBe(expected);
  });

  it.each([
    {
      name: 'span, logs present',
      presence: 'present',
      type: 'span',
      expected: 'See related logs',
    },
    {
      name: 'trace, logs present',
      presence: 'present',
      type: 'trace',
      expected: 'See related logs',
    },
    {
      name: 'span, logs absent',
      presence: 'absent',
      type: 'span',
      expected: 'No matching logs found for this span',
    },
    {
      name: 'trace, logs absent',
      presence: 'absent',
      type: 'trace',
      expected: 'No matching logs found for this trace',
    },
  ])('dynamic flag: $name', ({ presence, type, expected }) => {
    setTestFlags({ [FlagKeys.GrafanaDynamicTraceToLogs]: true });
    const settings = { jsonData: {} } as DataSourceInstanceSettings;

    // @ts-expect-error
    expect(getLogsButtonTooltip(settings, presence, type)).toBe(expected);
  });
});

describe('addNoSpanIdFallback', () => {
  const lokiSettings = {
    uid: 'loki1_uid',
    name: 'Loki',
    type: 'loki',
  } as DataSourceInstanceSettings;

  const defaultOptions = {
    customQuery: false,
    datasourceUid: 'loki1_uid',
  };

  function createSpan(overrides: Partial<TraceSpan> = {}): TraceSpan {
    return {
      spanID: '6605c7b08e715d6c',
      traceID: '7946b05c2e2e4e5a',
      processID: 'processId',
      operationName: 'operation',
      logs: [],
      startTime: new Date('2020-10-14T01:00:00Z').valueOf() * 1000,
      duration: 1000 * 1000,
      flags: 0,
      hasChildren: false,
      dataFrameRowIndex: 0,
      tags: [],
      process: {
        serviceName: 'checkout',
        tags: [
          { key: 'cluster', value: 'cluster1' },
          { key: 'hostname', value: 'hostname1' },
        ],
      },
      ...overrides,
    } as TraceSpan;
  }

  beforeEach(() => {
    setTestFlags({ [FlagKeys.GrafanaDynamicTraceToLogs]: true });
  });

  afterEach(() => {
    setTestFlags({});
  });

  it('returns the original query when there is no expr', () => {
    const query: DataQuery = { refId: 'A' };
    expect(addNoSpanIdFallback(query)).toEqual([query]);
  });

  it('strips structured span_id filters from span-level queries generated by logsLink', () => {
    const { query } = getTraceToLogsSpanQuery(createSpan(), lokiSettings, defaultOptions);
    const queries = query as LokiQuery[];
    const structured = queries.find((q) => q.refId === 't2l:default:trace_id');
    expect(structured).toBeDefined();
    expect(structured!.expr).toContain('span_id="6605c7b08e715d6c"');

    const [original, fallback] = addNoSpanIdFallback(structured!) as LokiQuery[];
    expect(original.expr).toBe(structured!.expr);
    expect(fallback.expr).toBe(
      '{cluster="cluster1", hostname="hostname1"} | logfmt | json | drop __error__ | trace_id="7946b05c2e2e4e5a"'
    );
    expect(fallback.expr).not.toMatch(/span_?id/i);
  });

  it('strips spanID / otel_span_id field-name variants from generated queries', () => {
    const { query } = getTraceToLogsSpanQuery(createSpan(), lokiSettings, defaultOptions);
    const queries = query as LokiQuery[];

    for (const refId of ['t2l:default:traceID', 't2l:default:otel_trace_id']) {
      const structured = queries.find((q) => q.refId === refId);
      expect(structured).toBeDefined();
      const [, fallback] = addNoSpanIdFallback(structured!) as LokiQuery[];
      expect(fallback.expr).toContain('trace');
      expect(fallback.expr).not.toMatch(/\|\s*(?:span_?id|otel_span_id)\b/i);
    }
  });

  it('strips every structured id-field variant produced by getTraceToLogsSpanQuery', () => {
    const span = createSpan();
    const { query } = getTraceToLogsSpanQuery(span, lokiSettings, defaultOptions);
    const queries = (query as LokiQuery[]).filter((q) => q.refId.startsWith('t2l:default:'));

    expect(queries.length).toBeGreaterThan(0);
    for (const structured of queries) {
      expect(structured.expr).toMatch(/\|\s*(?:span_?id|otel_span_id)\b/i);
      const result = addNoSpanIdFallback(structured) as LokiQuery[];
      expect(result).toHaveLength(2);
      expect(result[0].expr).toBe(structured.expr);
      expect(result[1].expr).toContain(`="${span.traceID}"`);
      expect(result[1].expr).not.toMatch(/\|\s*(?:span_?id|otel_span_id)\b/i);
      expect(result[1].expr).not.toContain(span.spanID);
    }
  });

  it('strips span filters from job-selector variants generated by logsLink', () => {
    const { query } = getTraceToLogsSpanQuery(createSpan(), lokiSettings, defaultOptions);
    const jobQuery = (query as LokiQuery[]).find((q) => q.refId === 't2l:job:trace_id');
    expect(jobQuery).toBeDefined();
    expect(jobQuery!.expr.startsWith('{job=~')).toBe(true);

    const [, fallback] = addNoSpanIdFallback(jobQuery!) as LokiQuery[];
    expect(fallback.expr).toBe(
      '{job=~"(.*/)?(checkout)"} | logfmt | json | drop __error__ | trace_id="7946b05c2e2e4e5a"'
    );
  });

  it('does not strip line-contains queries because they have no span field name', () => {
    const { query } = getTraceToLogsSpanQuery(createSpan(), lokiSettings, defaultOptions);
    const queries = query as LokiQuery[];
    const lineContains = queries.find((q) => q.refId === 't2l:line-contains');
    expect(lineContains).toBeDefined();
    expect(lineContains!.expr).toBe(
      '{cluster="cluster1", hostname="hostname1"} |= "7946b05c2e2e4e5a" |= "6605c7b08e715d6c"'
    );

    // Line filters only embed the span id value, not a span_* field name, so no fallback is added.
    expect(addNoSpanIdFallback(lineContains!)).toEqual([lineContains]);
  });

  it('does not add a fallback for trace-level queries that already omit span filters', () => {
    const span = createSpan();
    const trace = {
      traceID: span.traceID,
      spans: [span],
      processes: { p1: span.process },
    } as unknown as Trace;

    const { query } = getTraceToLogsTraceQuery(trace, lokiSettings, defaultOptions);
    const queries = query as LokiQuery[];
    const structured = queries.find((q) => q.refId === 't2l:default:trace_id');
    const lineContains = queries.find((q) => q.refId === 't2l:line-contains');

    expect(structured?.expr).not.toMatch(/span/i);
    expect(addNoSpanIdFallback(structured!)).toHaveLength(1);
    expect(addNoSpanIdFallback(lineContains!)).toHaveLength(1);
  });
});
