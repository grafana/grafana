import { render, prettyDOM, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { Provider } from 'react-redux';

import { type DataFrame, MutableDataFrame, type TraceSearchProps } from '@grafana/data';
import { mockTimeRange } from '@grafana/plugin-ui/test';
import {
  setPluginLinksHook,
  setPluginComponentsHook,
  useAppPluginInstalled,
  reportInteraction,
} from '@grafana/runtime';

import { configureStore } from '../../../store/configureStore';
import { DEFAULT_SPAN_FILTERS } from '../state/constants';

import { TraceView } from './TraceView';
import { SPAN_NAME } from './components/constants/span';
import { type TraceData, type TraceSpanData } from './components/types/trace';
import { transformDataFrames } from './utils/transform';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useAppPluginInstalled: jest.fn(),
  reportInteraction: jest.fn(),
}));

// The summary-span minimap gradient emits fractional rgb() channels that real browsers accept
// but jest-canvas-mock rejects. The canvas render is not exercised by these tests, so stub it.
jest.mock('./components/TracePageHeader/SpanGraph/render-into-canvas', () => ({
  ...jest.requireActual('./components/TracePageHeader/SpanGraph/render-into-canvas'),
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceSettings: jest.fn().mockReturnValue({ isLoading: false, settings: undefined }),
}));

const mockUseAppPluginInstalled = jest.mocked(useAppPluginInstalled);

function mockPluginInstalled(installedPluginIds: string[] = []) {
  mockUseAppPluginInstalled.mockImplementation((pluginId: string) => ({
    loading: false,
    error: undefined,
    value: installedPluginIds.includes(pluginId),
  }));
}

function getTraceView(frames: DataFrame[], spanFilters?: TraceSearchProps) {
  const store = configureStore();
  const topOfViewRef = createRef<HTMLDivElement>();

  return (
    <Provider store={store}>
      <TraceView
        dataFrames={frames}
        splitOpenFn={() => {}}
        traceProp={transformDataFrames(frames[0])!}
        datasource={undefined}
        topOfViewRef={topOfViewRef}
        timeRange={mockTimeRange()}
        spanFilters={spanFilters}
      />
    </Provider>
  );
}

function renderTraceView(frames = [frameOld], spanFilters?: TraceSearchProps) {
  const { container, baseElement } = render(getTraceView(frames, spanFilters));

  return {
    header: container.children[0],
    timeline: container.children[1],
    container,
    baseElement,
  };
}

function renderTraceViewNew() {
  return renderTraceView([frameNew]);
}

describe('TraceView', () => {
  beforeEach(() => {
    mockPluginInstalled();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  beforeAll(() => {
    setPluginLinksHook(() => ({
      isLoading: false,
      links: [],
    }));

    setPluginComponentsHook(() => ({
      isLoading: false,
      components: [],
    }));
  });

  it('renders TraceTimelineViewer', () => {
    const { timeline, header } = renderTraceView();
    expect(timeline).toBeDefined();
    expect(header).toBeDefined();
  });

  it('renders TraceTimelineViewer with new format', () => {
    const { timeline, header } = renderTraceViewNew();
    expect(timeline).toBeDefined();
    expect(header).toBeDefined();
  });

  it('renders renders the same for old and new format', () => {
    const { baseElement } = renderTraceViewNew();
    const { baseElement: baseElementOld } = renderTraceView();
    expect(prettyDOM(baseElement)).toEqual(prettyDOM(baseElementOld));
  });

  it('only renders noDataMsg on missing trace', () => {
    // Simulating Explore's access to empty response data
    const { container } = renderTraceView([]);
    expect(container.childNodes.length === 1).toBeTruthy();
  });

  it('toggles detailState', async () => {
    renderTraceViewNew();
    expect(screen.queryByText(/Span attributes/)).toBeFalsy();
    const spanView = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[0];
    await userEvent.click(spanView);
    expect(screen.queryByText(/Span attributes/)).toBeTruthy();

    await userEvent.click(spanView);
    screen.debug(screen.queryAllByText(/Span attributes/));
    expect(screen.queryByText(/Span attributes/)).toBeFalsy();
  });

  it('reports opening the detail of a summary span', async () => {
    renderTraceView([frameSummary]);
    const summarySpan = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[0];
    await userEvent.click(summarySpan);
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_traces_summary_span_detail_opened',
      expect.objectContaining({ spanCount: 4 })
    );
  });

  it('does not report a summary detail open for a normal span', async () => {
    renderTraceViewNew();
    const normalSpan = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[0];
    await userEvent.click(normalSpan);
    expect(reportInteraction).not.toHaveBeenCalledWith('grafana_traces_summary_span_detail_opened', expect.anything());
  });

  it('reports toggling the Summary attributes accordion', async () => {
    renderTraceView([frameSummary]);
    const summarySpan = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[0];
    await userEvent.click(summarySpan);
    await userEvent.click(screen.getByText(/Summary attributes/));
    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_traces_summary_attributes_toggled',
      expect.objectContaining({ isOpen: true })
    );
  });

  describe('Go to span', () => {
    // client-uuid-3 belongs to the errored span the banner points at, so finding it in a
    // resource attributes table proves the right span's detail is the one that opened.
    const bannerSpanIsOpen = () =>
      screen
        .getAllByText('', { selector: 'div[data-testid="KeyValueTable"]' })
        .some((table) => table.innerHTML.includes('client-uuid-3'));

    it('opens the detail of the banner span', async () => {
      renderTraceView([frameError]);
      expect(screen.queryByText(/Span attributes/)).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Go to span' }));

      expect(screen.getByText(/Span attributes/)).toBeInTheDocument();
      expect(bannerSpanIsOpen()).toBe(true);
    });

    it('leaves the detail open when clicked again', async () => {
      renderTraceView([frameError]);
      const goToSpan = screen.getByRole('button', { name: 'Go to span' });

      await userEvent.click(goToSpan);
      await userEvent.click(goToSpan);

      expect(bannerSpanIsOpen()).toBe(true);
    });

    it('leaves the detail open when the user already opened it from the timeline', async () => {
      renderTraceView([frameError]);
      const erroredSpan = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[2];
      await userEvent.click(erroredSpan);
      expect(bannerSpanIsOpen()).toBe(true);

      await userEvent.click(screen.getByRole('button', { name: 'Go to span' }));

      expect(bannerSpanIsOpen()).toBe(true);
    });

    // "Show all spans" is off exactly when the matches-only filter is on.
    const matchesOnly = (spanName: string): TraceSearchProps => ({
      ...DEFAULT_SPAN_FILTERS,
      matchesOnly: true,
      adhocFilters: [{ key: SPAN_NAME, operator: '=', value: spanName }],
    });

    it('turns matches-only off when the banner span is hidden by the filter', async () => {
      // Only the root span matches, so the errored banner span is filtered out of the timeline.
      renderTraceView([frameError], matchesOnly('HTTP POST - api_prom_push'));
      const showAllSpans = screen.getByRole('switch', { name: 'Show all spans' });
      expect(showAllSpans).not.toBeChecked();

      await userEvent.click(screen.getByRole('button', { name: 'Go to span' }));

      expect(showAllSpans).toBeChecked();
      expect(bannerSpanIsOpen()).toBe(true);
    });

    it('leaves matches-only on when the banner span already matches the filter', async () => {
      renderTraceView([frameError], matchesOnly('/logproto.Pusher/Push'));
      const showAllSpans = screen.getByRole('switch', { name: 'Show all spans' });
      expect(showAllSpans).not.toBeChecked();

      await userEvent.click(screen.getByRole('button', { name: 'Go to span' }));

      expect(showAllSpans).not.toBeChecked();
      expect(bannerSpanIsOpen()).toBe(true);
    });
  });

  it('shows timeline ticks', () => {
    renderTraceViewNew();
    function ticks() {
      return screen.getByText('', { selector: 'div[data-testid="TimelineHeaderRow"]' }).children[1].children[1]
        .textContent;
    }
    expect(ticks()).toBe('0μs274.5μs549μs823.5μs1.1ms');
  });

  it('correctly shows processes for each span', async () => {
    renderTraceView();
    expect(screen.queryAllByText('', { selector: 'div[data-testid="span-view"]' }).length).toBe(3);

    const firstSpan = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[0];
    await userEvent.click(firstSpan);
    // Resource attributes are open by default alongside span attributes
    expect(
      screen
        .getAllByText('', { selector: 'div[data-testid="KeyValueTable"]' })
        .some((table) => table.innerHTML.includes('client-uuid-1'))
    ).toBe(true);
    await userEvent.click(firstSpan);

    const secondSpan = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[1];
    await userEvent.click(secondSpan);
    expect(
      screen
        .getAllByText('', { selector: 'div[data-testid="KeyValueTable"]' })
        .some((table) => table.innerHTML.includes('client-uuid-2'))
    ).toBe(true);
    await userEvent.click(secondSpan);

    const thirdSpan = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[2];
    await userEvent.click(thirdSpan);
    expect(
      screen
        .getAllByText('', { selector: 'div[data-testid="KeyValueTable"]' })
        .some((table) => table.innerHTML.includes('client-uuid-3'))
    ).toBe(true);
  });

  it('resets detail view for new trace with the identical spanID', async () => {
    const { rerender } = render(getTraceView([frameOld]));
    const span = screen.getAllByText('', { selector: 'div[data-testid="span-view"]' })[2];
    await userEvent.click(span);
    //Process is in detail view
    expect(screen.getByText(/Resource/)).toBeInTheDocument();

    rerender(getTraceView([frameNew]));
    expect(screen.queryByText(/Resource/)).not.toBeInTheDocument();
  });

  describe('Adaptive Traces restored banner', () => {
    const restoredBannerTitle = /Trace restored by Adaptive Traces/;

    it('does not render the banner when no span has the restored attribute', async () => {
      renderTraceView();
      expect(screen.queryByText(restoredBannerTitle)).not.toBeInTheDocument();
    });

    it('does not render the banner when grafana-adaptivetraces-app is not installed', async () => {
      mockPluginInstalled();
      renderTraceView([frameRestoredByAdaptiveTraces]);
      expect(screen.queryByText(restoredBannerTitle)).not.toBeInTheDocument();
    });

    it('renders the banner when at least one span has grafana.adaptivetraces.restored=true', async () => {
      mockPluginInstalled(['grafana-adaptivetraces-app']);
      renderTraceView([frameRestoredByAdaptiveTraces]);
      expect(await screen.findByText(restoredBannerTitle)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /documentation/ })).toBeInTheDocument();
    });

    it('hides the banner after the user dismisses it', async () => {
      mockPluginInstalled(['grafana-adaptivetraces-app']);
      renderTraceView([frameRestoredByAdaptiveTraces]);
      expect(await screen.findByText(restoredBannerTitle)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /close alert/i }));
      expect(screen.queryByText(restoredBannerTitle)).not.toBeInTheDocument();
    });

    it('shows the banner again after dismiss when navigating directly to a different restored trace', async () => {
      mockPluginInstalled(['grafana-adaptivetraces-app']);
      const { rerender } = render(getTraceView([frameRestoredByAdaptiveTraces]));
      expect(await screen.findByText(restoredBannerTitle)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /close alert/i }));
      expect(screen.queryByText(restoredBannerTitle)).not.toBeInTheDocument();

      // Navigating straight from one restored trace to another must surface the banner again.
      rerender(getTraceView([frameRestoredByAdaptiveTracesB]));
      expect(await screen.findByText(restoredBannerTitle)).toBeInTheDocument();
    });
  });
});

const response: TraceData & { spans: TraceSpanData[] } = {
  traceID: '1ed38015486087ca',
  spans: [
    {
      traceID: '1ed38015486087ca',
      spanID: '1ed38015486087ca',
      flags: 1,
      operationName: 'HTTP POST - api_prom_push',
      references: [],
      startTime: 1585244579835187,
      duration: 1098,
      tags: [
        { key: 'sampler.type', type: 'string', value: 'const' },
        { key: 'sampler.param', type: 'bool', value: true },
        { key: 'span.kind', type: 'string', value: 'server' },
        { key: 'http.method', type: 'string', value: 'POST' },
        { key: 'http.url', type: 'string', value: '/api/prom/push' },
        { key: 'component', type: 'string', value: 'net/http' },
        { key: 'http.status_code', type: 'int64', value: 204 },
        { key: 'internal.span.format', type: 'string', value: 'proto' },
      ],
      logs: [
        {
          timestamp: 1585244579835229,
          fields: [{ key: 'event', type: 'string', value: 'util.ParseProtoRequest[start reading]' }],
        },
        {
          timestamp: 1585244579835241,
          fields: [
            { key: 'event', type: 'string', value: 'util.ParseProtoRequest[decompress]' },
            { key: 'size', type: 'int64', value: 315 },
          ],
        },
        {
          timestamp: 1585244579835245,
          fields: [
            { key: 'event', type: 'string', value: 'util.ParseProtoRequest[unmarshal]' },
            { key: 'size', type: 'int64', value: 446 },
          ],
        },
      ],
      processID: '1ed38015486087ca',
      warnings: null,
    },
    {
      traceID: '1ed38015486087ca',
      spanID: '3fb050342773d333',
      flags: 1,
      operationName: '/logproto.Pusher/Push',
      references: [{ refType: 'CHILD_OF', traceID: '1ed38015486087ca', spanID: '1ed38015486087ca' }],
      startTime: 1585244579835341,
      duration: 921,
      tags: [
        { key: 'span.kind', type: 'string', value: 'client' },
        { key: 'component', type: 'string', value: 'gRPC' },
        { key: 'internal.span.format', type: 'string', value: 'proto' },
      ],
      logs: [],
      processID: '3fb050342773d333',
      warnings: null,
    },
    {
      traceID: '1ed38015486087ca',
      spanID: '35118c298fc91f68',
      flags: 1,
      operationName: '/logproto.Pusher/Push',
      references: [{ refType: 'CHILD_OF', traceID: '1ed38015486087ca', spanID: '3fb050342773d333' }],
      startTime: 1585244579836040,
      duration: 36,
      tags: [
        { key: 'span.kind', type: 'string', value: 'server' },
        { key: 'component', type: 'string', value: 'gRPC' },
        { key: 'internal.span.format', type: 'string', value: 'proto' },
      ],
      logs: [],
      processID: '35118c298fc91f68',
      warnings: null,
    },
  ],
  processes: {
    '1ed38015486087ca': {
      serviceName: 'loki-all',
      tags: [
        { key: 'client-uuid', type: 'string', value: 'client-uuid-1' },
        { key: 'hostname', type: 'string', value: '0080b530fae3' },
        { key: 'ip', type: 'string', value: '172.18.0.6' },
        { key: 'jaeger.version', type: 'string', value: 'Go-2.20.1' },
      ],
    },
    '3fb050342773d333': {
      serviceName: 'loki-all',
      tags: [
        { key: 'client-uuid', type: 'string', value: 'client-uuid-2' },
        { key: 'hostname', type: 'string', value: '0080b530fae3' },
        { key: 'ip', type: 'string', value: '172.18.0.6' },
        { key: 'jaeger.version', type: 'string', value: 'Go-2.20.1' },
      ],
    },
    '35118c298fc91f68': {
      serviceName: 'loki-all',
      tags: [
        { key: 'client-uuid', type: 'string', value: 'client-uuid-3' },
        { key: 'hostname', type: 'string', value: '0080b530fae3' },
        { key: 'ip', type: 'string', value: '172.18.0.6' },
        { key: 'jaeger.version', type: 'string', value: 'Go-2.20.1' },
      ],
    },
  },
  warnings: null,
};

export const frameOld = new MutableDataFrame({
  fields: [
    {
      name: 'trace',
      values: [response],
    },
  ],
  meta: {
    preferredVisualisationType: 'trace',
  },
});

const frameNew = new MutableDataFrame({
  fields: [
    { name: 'traceID', values: ['1ed38015486087ca', '1ed38015486087ca', '1ed38015486087ca'] },
    { name: 'spanID', values: ['1ed38015486087ca', '3fb050342773d333', '35118c298fc91f68'] },
    { name: 'parentSpanID', values: [undefined, '1ed38015486087ca', '3fb050342773d333'] },
    { name: 'operationName', values: ['HTTP POST - api_prom_push', '/logproto.Pusher/Push', '/logproto.Pusher/Push'] },
    { name: 'serviceName', values: ['loki-all', 'loki-all', 'loki-all'] },
    {
      name: 'serviceTags',
      values: [
        [
          { key: 'client-uuid', value: '2a59d08899ef6a8a' },
          { key: 'hostname', value: '0080b530fae3' },
          { key: 'ip', value: '172.18.0.6' },
          { key: 'jaeger.version', value: 'Go-2.20.1' },
        ],
        [
          { key: 'client-uuid', value: '2a59d08899ef6a8a' },
          { key: 'hostname', value: '0080b530fae3' },
          { key: 'ip', value: '172.18.0.6' },
          { key: 'jaeger.version', value: 'Go-2.20.1' },
        ],
        [
          { key: 'client-uuid', value: '2a59d08899ef6a8a' },
          { key: 'hostname', value: '0080b530fae3' },
          { key: 'ip', value: '172.18.0.6' },
          { key: 'jaeger.version', value: 'Go-2.20.1' },
        ],
      ],
    },
    { name: 'startTime', values: [1585244579835.187, 1585244579835.341, 1585244579836.04] },
    { name: 'duration', values: [1.098, 0.921, 0.036] },
    {
      name: 'logs',
      values: [
        [
          {
            timestamp: 1585244579835.229,
            fields: [{ key: 'event', value: 'util.ParseProtoRequest[start reading]' }],
          },
          {
            timestamp: 1585244579835.241,
            fields: [
              { key: 'event', value: 'util.ParseProtoRequest[decompress]' },
              { key: 'size', value: 315 },
            ],
          },
          {
            timestamp: 1585244579835.245,
            fields: [
              { key: 'event', value: 'util.ParseProtoRequest[unmarshal]' },
              { key: 'size', value: 446 },
            ],
          },
        ],
        [],
        [],
      ],
    },
    {
      name: 'tags',
      values: [
        [
          { key: 'sampler.type', value: 'const' },
          { key: 'sampler.param', value: true },
          { key: 'span.kind', value: 'server' },
          { key: 'http.method', value: 'POST' },
          { key: 'http.url', value: '/api/prom/push' },
          { key: 'component', value: 'net/http' },
          { key: 'http.status_code', value: 204 },
          { key: 'internal.span.format', value: 'proto' },
        ],
        [
          { key: 'span.kind', value: 'client' },
          { key: 'component', value: 'gRPC' },
          { key: 'internal.span.format', value: 'proto' },
        ],
        [
          { key: 'span.kind', value: 'server' },
          { key: 'component', value: 'gRPC' },
          { key: 'internal.span.format', value: 'proto' },
        ],
      ],
    },
    { name: 'warnings', values: [undefined, undefined] },
    { name: 'stackTraces', values: [undefined, undefined] },
  ],
  meta: {
    preferredVisualisationType: 'trace',
  },
});

const restoredResponse: TraceData & { spans: TraceSpanData[] } = {
  ...response,
  spans: response.spans.map((span, index) =>
    index === 0
      ? {
          ...span,
          tags: [...(span.tags ?? []), { key: 'grafana.adaptivetraces.restored', type: 'bool', value: true }],
        }
      : span
  ),
};

const summaryResponse: TraceData & { spans: TraceSpanData[] } = {
  ...response,
  spans: response.spans.map((span, index) =>
    index === 0
      ? {
          ...span,
          tags: [
            ...(span.tags ?? []),
            { key: 'aggregation.is_summary', type: 'bool', value: true },
            { key: 'aggregation.span_count', type: 'int64', value: 4 },
          ],
        }
      : span
  ),
};

// The deepest span carries the error tag, so the header renders a trace banner pointing at it.
const errorResponse: TraceData & { spans: TraceSpanData[] } = {
  ...response,
  spans: response.spans.map((span, index) =>
    index === 2 ? { ...span, tags: [...(span.tags ?? []), { key: 'error', type: 'bool', value: true }] } : span
  ),
};

export const frameError = new MutableDataFrame({
  fields: [
    {
      name: 'trace',
      values: [errorResponse],
    },
  ],
  meta: {
    preferredVisualisationType: 'trace',
  },
});

const frameSummary = new MutableDataFrame({
  fields: [
    {
      name: 'trace',
      values: [summaryResponse],
    },
  ],
  meta: {
    preferredVisualisationType: 'trace',
  },
});

const frameRestoredByAdaptiveTraces = new MutableDataFrame({
  fields: [
    {
      name: 'trace',
      values: [restoredResponse],
    },
  ],
  meta: {
    preferredVisualisationType: 'trace',
  },
});

const restoredResponseB: TraceData & { spans: TraceSpanData[] } = {
  ...restoredResponse,
  traceID: '2bc49126597198db',
  spans: restoredResponse.spans.map((span) => ({ ...span, traceID: '2bc49126597198db' })),
};

const frameRestoredByAdaptiveTracesB = new MutableDataFrame({
  fields: [
    {
      name: 'trace',
      values: [restoredResponseB],
    },
  ],
  meta: {
    preferredVisualisationType: 'trace',
  },
});
