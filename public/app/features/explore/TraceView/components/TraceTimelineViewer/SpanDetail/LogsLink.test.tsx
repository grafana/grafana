import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of, throwError } from 'rxjs';

import { type DataSourceApi, type DataSourceInstanceSettings, type LinkModel, toDataFrame } from '@grafana/data';
import { useFlagGrafanaDynamicTraceToLogs } from '@grafana/runtime/internal';
import { getDataSourceInstance, useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { type DataQuery } from '@grafana/schema';

import { SpanLinkType, type SpanLinkModel } from '../../types/links';

import { getLogsButtonCTA, getLogsButtonTooltip, LogsLinkButton } from './LogsLink';

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
  useDataSourceInstanceSettings: jest.fn().mockReturnValue({ isLoading: false, settings: undefined }),
}));

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  useFlagGrafanaDynamicTraceToLogs: jest.fn(),
}));

const getDataSourceInstanceMock = jest.mocked(getDataSourceInstance);
const useDataSourceInstanceSettingsMock = jest.mocked(useDataSourceInstanceSettings);
const useFlagGrafanaDynamicTraceToLogsMock = jest.mocked(useFlagGrafanaDynamicTraceToLogs);

const CTA_RELATED_LOGS = 'Related logs';

function createSpanLinkModel(overrides: Partial<LinkModel> = {}): SpanLinkModel {
  return {
    type: SpanLinkType.Logs,
    icon: 'gf-logs',
    traceDatasourceUid: 'trace-ds-uid',
    linkModel: {
      href: '/logs',
      title: CTA_RELATED_LOGS,
      target: '_blank',
      origin: {},
      ...overrides,
    },
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

describe('LogsLinkButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDataSourceInstanceSettingsMock.mockReturnValue({ isLoading: false, settings: undefined });
    // The presence check is gated behind this flag; enable it so most tests exercise the check.
    useFlagGrafanaDynamicTraceToLogsMock.mockReturnValue(true);
  });

  it('renders the link button with its CTA copy', () => {
    render(<LogsLinkButton spanLinkModel={createSpanLinkModel()} />);

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText(CTA_RELATED_LOGS)).toBeInTheDocument();
  });

  it('does not query the datasource when the link has no interpolated query', () => {
    render(<LogsLinkButton spanLinkModel={createSpanLinkModel()} />);

    expect(getDataSourceInstanceMock).not.toHaveBeenCalled();
  });

  it('does not check for logs when the dynamicTraceToLogs flag is disabled', async () => {
    useFlagGrafanaDynamicTraceToLogsMock.mockReturnValue(false);
    useDataSourceInstanceSettingsMock.mockReturnValue({
      isLoading: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      settings: { jsonData: {} } as any,
    });
    mockDatasourceReturningFrames([emptyFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton spanLinkModel={createSpanLinkModel({ interpolatedParams: { query: interpolatedQuery } })} />
    );

    // The datasource is never queried, and the button stays enabled (present).
    expect(getDataSourceInstanceMock).not.toHaveBeenCalled();
    await userEvent.hover(await screen.findByRole('button'));
    expect(await screen.findByText('View related logs using the trace data source configuration.')).toBeInTheDocument();
    expect(
      screen.queryByText('No related logs found using the trace data source configuration.')
    ).not.toBeInTheDocument();
  });

  it('runs the interpolated query against its datasource to check for logs', async () => {
    const query = mockDatasourceReturningFrames([logsFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton spanLinkModel={createSpanLinkModel({ interpolatedParams: { query: interpolatedQuery } })} />
    );

    await waitFor(() => expect(getDataSourceInstanceMock).toHaveBeenCalledWith(interpolatedQuery.datasource));
    expect(query).toHaveBeenCalledWith(expect.objectContaining({ targets: [interpolatedQuery] }));
  });

  it('limits the presence check to a single log line for loki datasources', async () => {
    const query = mockDatasourceReturningFrames([logsFrame], 'loki');
    const interpolatedQuery: DataQuery = { refId: 'A', datasource: { uid: 'logs-ds-uid', type: 'loki' } };

    render(
      <LogsLinkButton spanLinkModel={createSpanLinkModel({ interpolatedParams: { query: interpolatedQuery } })} />
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
      <LogsLinkButton spanLinkModel={createSpanLinkModel({ interpolatedParams: { query: interpolatedQuery } })} />
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
      <LogsLinkButton spanLinkModel={createSpanLinkModel({ interpolatedParams: { query: interpolatedQuery } })} />
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
      <LogsLinkButton spanLinkModel={createSpanLinkModel({ interpolatedParams: { query: interpolatedQuery } })} />
    );

    await waitFor(() => expect(getDataSourceInstanceMock).toHaveBeenCalled());
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByText('View related logs using the trace data source configuration.')).toBeInTheDocument();
  });

  it('fails open (keeps the link enabled) when the presence check errors', async () => {
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
      <LogsLinkButton spanLinkModel={createSpanLinkModel({ interpolatedParams: { query: interpolatedQuery } })} />
    );

    await waitFor(() => expect(query).toHaveBeenCalled());
    await userEvent.hover(screen.getByRole('button'));
    expect(await screen.findByText('View related logs using the trace data source configuration.')).toBeInTheDocument();
    expect(
      screen.queryByText('No related logs found using the trace data source configuration.')
    ).not.toBeInTheDocument();
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
