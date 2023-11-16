import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LinkModel } from '@grafana/data';

import { getAbsoluteTime } from '../TraceTimelineViewer/SpanDetail';
import DetailState from '../TraceTimelineViewer/SpanDetail/DetailState';
import traceGenerator from '../demo/trace-generators';
import transformTraceData from '../model/transform-trace-data';
import { SpanLinkDef } from '../types';
import { SpanLinkType } from '../types/links';
import { TraceSpan } from '../types/trace';

import { DetailPanel } from './DetailPanel';

const setup = () => {
  const span = transformTraceData(traceGenerator.trace({ numberOfSpans: 1 }))!.spans[0];
  const traceStartTime = 5;

  span.spanID = 'test-id';
  span.kind = 'test-kind';
  span.statusCode = 2;
  span.statusMessage = 'test-message';
  span.instrumentationLibraryName = 'test-name';
  span.instrumentationLibraryVersion = 'test-version';
  span.traceState = 'test-state';

  span.tags = [
    { key: 'key1', value: 'value1' },
    { key: 'key2', value: 'value2' },
  ];

  span.process = {
    serviceName: 'test-service',
    tags: [
      { key: 'processKey1', value: 'processValue1' },
      { key: 'processKey2', value: 'processValue2' },
    ],
  };

  span.logs = [
    {
      timestamp: 10,
      fields: [{ key: 'message', value: 'log message' }],
    },
    {
      timestamp: 20,
      fields: [{ key: 'message', value: 'next message' }],
    },
  ];

  span.warnings = ['Warning 1', 'Warning 2'];
  span.stackTraces = ['Stack trace 1', 'Stack trace 2'];

  span.references = [
    {
      refType: 'CHILD_OF',
      span: {
        spanID: 'span1',
        traceID: 'trace1',
        operationName: 'op1',
        process: {
          serviceName: 'service1',
          tags: [{ key: 'tag1', value: 'value1' }],
        },
      } as unknown as TraceSpan,
      spanID: 'span1',
      traceID: 'trace1',
    },
    {
      refType: 'CHILD_OF',
      spanID: 'span2',
      traceID: 'trace2',
    },
  ];

  const props = {
    span,
    timeZone: 'utc',
    clearSelectedSpan: jest.fn(),
    detailStates: new Map<string, DetailState>().set(span.spanID, new DetailState()),
    width: 200,
    traceStartTime,
    detailLogItemToggle: jest.fn(),
    createFocusSpanLink: () => {
      return {
        title: 'Deep link to this span',
        href: '/explore?left',
        target: '_self',
        origin: {},
      } as LinkModel;
    },
    createSpanLink: () => {
      return [
        {
          title: 'link',
          type: SpanLinkType.Logs,
          href: 'url',
        } as SpanLinkDef,
      ];
    },
    datasourceType: 'unknown',
    scrollToSpan: jest.fn(),
  };

  return {
    elem: render(<DetailPanel {...props} />),
    span,
  };
};

describe('DetailsPanel', () => {
  it('renders without exploding', () => {
    expect(() => setup()).not.toThrow();
  });

  it('lists the operation, service name, duration, start time and kind', () => {
    const { span } = setup();
    expect(screen.getByRole('heading', { name: span.operationName })).toBeInTheDocument();
    expect(screen.getByText('Duration:')).toBeInTheDocument();
    expect(screen.getByText('Service:')).toBeInTheDocument();
    expect(screen.getByText('Start Time:')).toBeInTheDocument();
    expect(screen.getByText('Kind:')).toBeInTheDocument();
    expect(screen.getByText('test-kind')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('Status Message:')).toBeInTheDocument();
    expect(screen.getByText('test-message')).toBeInTheDocument();
    expect(screen.getByText('Library Name:')).toBeInTheDocument();
    expect(screen.getByText('test-name')).toBeInTheDocument();
    expect(screen.getByText('Library Version:')).toBeInTheDocument();
    expect(screen.getByText('test-version')).toBeInTheDocument();
    expect(screen.getByText('Trace State:')).toBeInTheDocument();
    expect(screen.getByText('test-state')).toBeInTheDocument();
  });

  it('start time shows the absolute time', () => {
    const { span } = setup();
    expect(
      screen.getByText((text) => {
        return text.includes(getAbsoluteTime(span.startTime, 'UTC'));
      })
    ).toBeInTheDocument();
  });

  it('renders tabs', async () => {
    setup();
    expect(screen.getByText('Attributes')).toBeInTheDocument();
    expect(screen.getByText('Events')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.getByText('Stack Traces')).toBeInTheDocument();
    expect(screen.getByText('References')).toBeInTheDocument();
  });

  it('renders tags and process tags', async () => {
    setup();
    expect(screen.getByText('Span Attributes')).toBeInTheDocument();
    expect(screen.getByText('Resource Attributes')).toBeInTheDocument();
    expect(screen.getByText('key1')).toBeInTheDocument();
    expect(screen.getByText('"value1"')).toBeInTheDocument();
    expect(screen.getByText('key2')).toBeInTheDocument();
    expect(screen.getByText('"value2"')).toBeInTheDocument();
    expect(screen.getByText('processKey1')).toBeInTheDocument();
    expect(screen.getByText('"processValue1"')).toBeInTheDocument();
    expect(screen.getByText('processKey2')).toBeInTheDocument();
    expect(screen.getByText('"processValue2"')).toBeInTheDocument();
  });

  it('renders events', async () => {
    setup();
    userEvent.click(screen.getByText('Events'));
    await waitFor(async () => {
      expect(screen.getByText(/log message/)).toBeInTheDocument();
      expect(screen.getByText(/next message/)).toBeInTheDocument();
    });
  });

  it('renders warnings', async () => {
    setup();
    userEvent.click(screen.getByText('Warnings'));
    await waitFor(async () => {
      expect(screen.getByText('Warning 1')).toBeInTheDocument();
      expect(screen.getByText('Warning 2')).toBeInTheDocument();
    });
  });

  it('renders stack traces', async () => {
    setup();
    userEvent.click(screen.getByText('Stack Traces'));
    await waitFor(async () => {
      expect(screen.getByText(/Stack trace 1/)).toBeInTheDocument();
      expect(screen.getByText(/Stack trace 2/)).toBeInTheDocument();
    });
  });

  it('renders references', async () => {
    setup();
    userEvent.click(screen.getByText('References'));
    await waitFor(async () => {
      expect(screen.getByText('service1')).toBeInTheDocument();
      expect(screen.getByText('op1')).toBeInTheDocument();
      expect(screen.getByText(/trace1/)).toBeInTheDocument();
      expect(screen.getByText(/span1/)).toBeInTheDocument();
      expect(screen.getByText('View Linked Span')).toBeInTheDocument();
      expect(screen.getByText(/trace2/)).toBeInTheDocument();
      expect(screen.getByText(/span2/)).toBeInTheDocument();
    });
  });

  it('renders logs for this span', () => {
    setup();
    expect(screen.getByText('Logs for this span')).toBeDefined();
  });
});
