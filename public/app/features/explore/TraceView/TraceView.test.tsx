import React from 'react';
import { render, prettyDOM, screen } from '@testing-library/react';
import { TraceView } from './TraceView';
import { setDataSourceSrv } from '@grafana/runtime';
import { ExploreId } from 'app/types';
import { TraceData, TraceSpanData } from '@jaegertracing/jaeger-ui-components/src/types/trace';
import { MutableDataFrame } from '@grafana/data';
import { configureStore } from '../../../store/configureStore';
import { Provider } from 'react-redux';
import userEvent from '@testing-library/user-event';

function renderTraceView(frames = [frameOld]) {
  const store = configureStore();
  const { container, baseElement } = render(
    <Provider store={store}>
      <TraceView exploreId={ExploreId.left} dataFrames={frames} splitOpenFn={() => {}} />
    </Provider>
  );
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
  beforeAll(() => {
    setDataSourceSrv({
      getInstanceSettings() {
        return undefined;
      },
    } as any);
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

  it('does not render anything on missing trace', () => {
    // Simulating Explore's access to empty response data
    const { container } = renderTraceView([]);
    expect(container.hasChildNodes()).toBeFalsy();
  });

  it('toggles detailState', async () => {
    renderTraceViewNew();
    expect(screen.queryByText(/Tags/)).toBeFalsy();
    const spanView = screen.getAllByText('', { selector: 'div[data-test-id="span-view"]' })[0];
    userEvent.click(spanView);
    expect(screen.queryByText(/Tags/)).toBeTruthy();

    userEvent.click(spanView);
    screen.debug(screen.queryAllByText(/Tags/));
    expect(screen.queryByText(/Tags/)).toBeFalsy();
  });

  it('toggles children visibility', () => {
    renderTraceViewNew();
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
    userEvent.click(screen.getAllByText('', { selector: 'span[data-test-id="SpanTreeOffset--indentGuide"]' })[0]);
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(1);

    userEvent.click(screen.getAllByText('', { selector: 'span[data-test-id="SpanTreeOffset--indentGuide"]' })[0]);
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
  });

  it('toggles collapses and expands one level of spans', () => {
    renderTraceViewNew();
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
    userEvent.click(screen.getByLabelText('Collapse +1'));
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(2);
    userEvent.click(screen.getByLabelText('Expand +1'));
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
  });

  it('toggles collapses and expands all levels', () => {
    renderTraceViewNew();
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
    userEvent.click(screen.getByLabelText('Collapse All'));
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(1);
    userEvent.click(screen.getByLabelText('Expand All'));
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);
  });

  it('searches for spans', () => {
    renderTraceViewNew();
    userEvent.type(screen.getByPlaceholderText('Find...'), '1ed38015486087ca');
    expect(
      (screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' })[0].parentNode! as HTMLElement).className
    ).toContain('rowMatchingFilter');
  });

  it('shows timeline ticks', () => {
    renderTraceViewNew();
    function ticks() {
      return screen.getByText('', { selector: 'div[data-test-id="TimelineHeaderRow"]' }).children[1].children[1]
        .textContent;
    }
    expect(ticks()).toBe('0μs274.5μs549μs823.5μs1.1ms');
  });

  it('correctly shows processes for each span', () => {
    renderTraceView();
    let table: HTMLElement;
    expect(screen.queryAllByText('', { selector: 'div[data-test-id="span-view"]' }).length).toBe(3);

    const firstSpan = screen.getAllByText('', { selector: 'div[data-test-id="span-view"]' })[0];
    userEvent.click(firstSpan);
    userEvent.click(screen.getByText(/Process/));
    table = screen.getByText('', { selector: 'div[data-test-id="KeyValueTable"]' });
    expect(table.innerHTML).toContain('client-uuid-1');
    userEvent.click(firstSpan);

    const secondSpan = screen.getAllByText('', { selector: 'div[data-test-id="span-view"]' })[1];
    userEvent.click(secondSpan);
    userEvent.click(screen.getByText(/Process/));
    table = screen.getByText('', { selector: 'div[data-test-id="KeyValueTable"]' });
    expect(table.innerHTML).toContain('client-uuid-2');
    userEvent.click(secondSpan);

    const thirdSpan = screen.getAllByText('', { selector: 'div[data-test-id="span-view"]' })[2];
    userEvent.click(thirdSpan);
    userEvent.click(screen.getByText(/Process/));
    table = screen.getByText('', { selector: 'div[data-test-id="KeyValueTable"]' });
    expect(table.innerHTML).toContain('client-uuid-3');
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
      references: [] as any,
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
      warnings: null as any,
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
      logs: [] as any,
      processID: '35118c298fc91f68',
      warnings: null as any,
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
  warnings: null as any,
};

const frameOld = new MutableDataFrame({
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
