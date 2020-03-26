import React from 'react';
import { shallow } from 'enzyme';
import { TraceView } from './TraceView';
import { SpanData, TraceData, TraceTimelineViewer } from '@jaegertracing/jaeger-ui-components';

describe('TraceView', () => {
  it('renders TraceTimelineViewer', () => {
    const wrapper = shallow(<TraceView trace={response} />);
    expect(wrapper.find(TraceTimelineViewer)).toHaveLength(1);
  });

  it('toggles detailState', () => {
    const wrapper = shallow(<TraceView trace={response} />);
    let viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.detailStates.size).toBe(0);

    viewer.props().detailToggle('1');
    viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.detailStates.size).toBe(1);
    expect(viewer.props().traceTimeline.detailStates.get('1')).not.toBeUndefined();

    viewer.props().detailToggle('1');
    viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.detailStates.size).toBe(0);
  });

  it('toggles children visibility', () => {
    const wrapper = shallow(<TraceView trace={response} />);
    let viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.size).toBe(0);

    viewer.props().childrenToggle('1');
    viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.size).toBe(1);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.has('1')).toBeTruthy();

    viewer.props().childrenToggle('1');
    viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.size).toBe(0);
  });

  it('toggles adds and removes hover indent guides', () => {
    const wrapper = shallow(<TraceView trace={response} />);
    let viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.hoverIndentGuideIds.size).toBe(0);

    viewer.props().addHoverIndentGuideId('1');
    viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.hoverIndentGuideIds.size).toBe(1);
    expect(viewer.props().traceTimeline.hoverIndentGuideIds.has('1')).toBeTruthy();

    viewer.props().removeHoverIndentGuideId('1');
    viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.hoverIndentGuideIds.size).toBe(0);
  });

  it('toggles collapses and expands one level of spans', () => {
    const wrapper = shallow(<TraceView trace={response} />);
    let viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.size).toBe(0);
    const spans = viewer.props().trace.spans;

    viewer.props().collapseOne(spans);
    viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.size).toBe(1);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.has('3fb050342773d333')).toBeTruthy();

    viewer.props().expandOne(spans);
    viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.size).toBe(0);
  });

  it('toggles collapses and expands all levels', () => {
    const wrapper = shallow(<TraceView trace={response} />);
    let viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.size).toBe(0);
    const spans = viewer.props().trace.spans;

    viewer.props().collapseAll(spans);
    viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.size).toBe(2);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.has('3fb050342773d333')).toBeTruthy();
    expect(viewer.props().traceTimeline.childrenHiddenIDs.has('1ed38015486087ca')).toBeTruthy();

    viewer.props().expandAll();
    viewer = wrapper.find(TraceTimelineViewer);
    expect(viewer.props().traceTimeline.childrenHiddenIDs.size).toBe(0);
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
