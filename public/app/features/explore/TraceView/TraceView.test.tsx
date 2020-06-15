import React from 'react';
import { shallow } from 'enzyme';
import { TraceView } from './TraceView';
import { SpanData, TraceData, TracePageHeader, TraceTimelineViewer } from '@jaegertracing/jaeger-ui-components';

function renderTraceView() {
  const wrapper = shallow(<TraceView trace={response} />);
  return {
    timeline: wrapper.find(TraceTimelineViewer),
    header: wrapper.find(TracePageHeader),
    wrapper,
  };
}

describe('TraceView', () => {
  it('renders TraceTimelineViewer', () => {
    const { timeline, header } = renderTraceView();
    expect(timeline).toHaveLength(1);
    expect(header).toHaveLength(1);
  });

  it('toggles detailState', () => {
    let { timeline, wrapper } = renderTraceView();
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
    let { timeline, wrapper } = renderTraceView();
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
    let { timeline, wrapper } = renderTraceView();
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
    let { timeline, wrapper } = renderTraceView();
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
    let { timeline, wrapper } = renderTraceView();
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
    let { wrapper, header } = renderTraceView();
    header.props().onSearchValueChange('HTTP POST - api_prom_push');

    const timeline = wrapper.find(TraceTimelineViewer);
    expect(timeline.props().findMatchesIDs?.has('1ed38015486087ca')).toBeTruthy();
  });

  it('change viewRange', () => {
    let { header, timeline, wrapper } = renderTraceView();
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

const response: TraceData & { spans: SpanData[] } = {
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
