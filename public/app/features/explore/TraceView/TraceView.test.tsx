import React from 'react';
import { shallow } from 'enzyme';
import { render, prettyDOM } from '@testing-library/react';
import { TraceView } from './TraceView';
import { TracePageHeader, TraceTimelineViewer } from '@jaegertracing/jaeger-ui-components';
import { setDataSourceSrv } from '@grafana/runtime';
import { ExploreId } from 'app/types';
import { TraceData, TraceSpanData } from '@jaegertracing/jaeger-ui-components/src/types/trace';
import { MutableDataFrame } from '@grafana/data';

jest.mock('react-redux', () => ({
  useSelector: jest.fn(() => undefined),
  connect: jest.fn((v) => v),
}));

function renderTraceView() {
  const wrapper = shallow(<TraceView exploreId={ExploreId.left} dataFrames={[frameOld]} splitOpenFn={() => {}} />);
  return {
    timeline: wrapper.find(TraceTimelineViewer),
    header: wrapper.find(TracePageHeader),
    wrapper,
  };
}

function renderTraceViewNew() {
  const wrapper = shallow(<TraceView exploreId={ExploreId.left} dataFrames={[frameNew]} splitOpenFn={() => {}} />);
  return {
    timeline: wrapper.find(TraceTimelineViewer),
    header: wrapper.find(TracePageHeader),
    wrapper,
  };
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
    expect(timeline).toHaveLength(1);
    expect(header).toHaveLength(1);
  });

  it('renders TraceTimelineViewer with new format', () => {
    const { timeline, header } = renderTraceViewNew();
    expect(timeline).toHaveLength(1);
    expect(header).toHaveLength(1);
  });

  it('renders renders the same for old and new format', () => {
    const { baseElement } = render(
      <TraceView exploreId={ExploreId.left} dataFrames={[frameNew]} splitOpenFn={() => {}} />
    );
    const { baseElement: baseElementOld } = render(
      <TraceView exploreId={ExploreId.left} dataFrames={[frameOld]} splitOpenFn={() => {}} />
    );
    expect(prettyDOM(baseElement)).toEqual(prettyDOM(baseElementOld));
  });

  it('does not render anything on missing trace', () => {
    // Simulating Explore's access to empty response data
    const { container } = render(<TraceView exploreId={ExploreId.left} dataFrames={[]} splitOpenFn={() => {}} />);
    expect(container.hasChildNodes()).toBeFalsy();
  });

  it('toggles detailState', () => {
    let { timeline, wrapper } = renderTraceViewNew();
    expect(timeline.props().traceTimeline.detailStates.size).toBe(0);

    timeline.props().detailToggle('1');
    timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().traceTimeline.detailStates.size).toBe(1);
    expect(timeline.props().traceTimeline.detailStates.get('1')).not.toBeUndefined();

    timeline.props().detailToggle('1');
    timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().traceTimeline.detailStates.size).toBe(0);
  });

  it('toggles children visibility', () => {
    let { timeline, wrapper } = renderTraceViewNew();
    expect(timeline.props().traceTimeline.childrenHiddenIDs.size).toBe(0);

    timeline.props().childrenToggle('1');
    timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().traceTimeline.childrenHiddenIDs.size).toBe(1);
    expect(timeline.props().traceTimeline.childrenHiddenIDs.has('1')).toBeTruthy();

    timeline.props().childrenToggle('1');
    timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().traceTimeline.childrenHiddenIDs.size).toBe(0);
  });

  it('toggles adds and removes hover indent guides', () => {
    let { timeline, wrapper } = renderTraceViewNew();
    expect(timeline.props().traceTimeline.hoverIndentGuideIds.size).toBe(0);

    timeline.props().addHoverIndentGuideId('1');
    timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().traceTimeline.hoverIndentGuideIds.size).toBe(1);
    expect(timeline.props().traceTimeline.hoverIndentGuideIds.has('1')).toBeTruthy();

    timeline.props().removeHoverIndentGuideId('1');
    timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().traceTimeline.hoverIndentGuideIds.size).toBe(0);
  });

  it('toggles collapses and expands one level of spans', () => {
    let { timeline, wrapper } = renderTraceViewNew();
    expect(timeline.props().traceTimeline.childrenHiddenIDs.size).toBe(0);
    const spans = timeline.props().trace.spans;

    timeline.props().collapseOne(spans);
    timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().traceTimeline.childrenHiddenIDs.size).toBe(1);
    expect(timeline.props().traceTimeline.childrenHiddenIDs.has('3fb050342773d333')).toBeTruthy();

    timeline.props().expandOne(spans);
    timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().traceTimeline.childrenHiddenIDs.size).toBe(0);
  });

  it('toggles collapses and expands all levels', () => {
    let { timeline, wrapper } = renderTraceViewNew();
    expect(timeline.props().traceTimeline.childrenHiddenIDs.size).toBe(0);
    const spans = timeline.props().trace.spans;

    timeline.props().collapseAll(spans);
    timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().traceTimeline.childrenHiddenIDs.size).toBe(2);
    expect(timeline.props().traceTimeline.childrenHiddenIDs.has('3fb050342773d333')).toBeTruthy();
    expect(timeline.props().traceTimeline.childrenHiddenIDs.has('1ed38015486087ca')).toBeTruthy();

    timeline.props().expandAll();
    timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().traceTimeline.childrenHiddenIDs.size).toBe(0);
  });

  it('searches for spans', () => {
    let { wrapper, header } = renderTraceViewNew();
    header.props().onSearchValueChange('HTTP POST - api_prom_push');

    const timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().findMatchesIDs?.has('1ed38015486087ca')).toBeTruthy();
  });

  it('change viewRange', () => {
    let { header, timeline, wrapper } = renderTraceViewNew();
    const defaultRange = { time: { current: [0, 1] } };
    expect(timeline.props().viewRange).toEqual(defaultRange);
    expect(header.props().viewRange).toEqual(defaultRange);
    header.props().updateViewRangeTime(0.2, 0.8);

    let newRange = { time: { current: [0.2, 0.8] } };
    timeline = wrapper.find(TraceTimelineViewer);
    header = wrapper.find(TracePageHeader);
    expect(timeline.props().viewRange).toEqual(newRange);
    expect(header.props().viewRange).toEqual(newRange);

    newRange = { time: { current: [0.3, 0.7] } };
    timeline.props().updateViewRangeTime(0.3, 0.7);
    timeline = wrapper.find(TraceTimelineViewer);
    header = wrapper.find(TracePageHeader);
    expect(timeline.props().viewRange).toEqual(newRange);
    expect(header.props().viewRange).toEqual(newRange);
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
      processID: 'p1',
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
      processID: 'p1',
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
      processID: 'p1',
      warnings: null as any,
    },
  ],
  processes: {
    p1: {
      serviceName: 'loki-all',
      tags: [
        { key: 'client-uuid', type: 'string', value: '2a59d08899ef6a8a' },
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
