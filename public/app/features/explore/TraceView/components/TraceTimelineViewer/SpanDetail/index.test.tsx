// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

jest.mock('../../utils/date');

// Controls the measured container width so the two-column layout decision is
// deterministic in tests (real measurement needs layout jsdom doesn't do).
let mockMeasuredWidth = 0;
jest.mock('react-use/lib/useMeasure', () => ({
  __esModule: true,
  default: () => [jest.fn(), { width: mockMeasuredWidth }],
}));

// SpanDetailLinkButtons resolves data source settings via an async hook; return a
// synchronous value so rendering doesn't trigger an un-acted state update in tests.
jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  useDataSourceInstanceSettings: jest.fn().mockReturnValue({ isLoading: false, settings: undefined }),
}));

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDataFrame, type DataSourceInstanceSettings, dateTime } from '@grafana/data';
import { data } from '@grafana/flamegraph';
import { type DataSourceSrv, setDataSourceSrv, setPluginLinksHook } from '@grafana/runtime';

import { pyroscopeProfileIdTagKey } from '../../../createSpanLink';
import traceGenerator from '../../demo/trace-generators';
import transformTraceData from '../../model/transform-trace-data';
import { type TraceSpanReference } from '../../types/trace';
import { formatDuration } from '../../utils/date';

import DetailState from './DetailState';

import SpanDetail, { getAbsoluteTime, type SpanDetailProps } from './index';

describe('<SpanDetail>', () => {
  // use `transformTraceData` on a fake trace to get a fully processed span
  const span = transformTraceData(traceGenerator.trace({ numberOfSpans: 1 }))!.spans[0];
  const detailState = new DetailState().toggleLogs().toggleProcess().toggleReferences().toggleTags();
  const traceStartTime = 5;
  const topOfExploreViewRef = jest.fn();
  const request = {
    targets: [{ refId: 'A', target: 'query' }],
  };
  const traceToProfilesOptions = {
    datasourceUid: 'profiling1_uid',
    tags: [{ key: 'someTag', value: 'newName' }],
    customQuery: true,
    query: '{${__tags}}',
    type: 'grafana-pyroscope-datasource',
  };
  const pyroSettings = {
    uid: 'profiling1_uid',
    name: 'profiling1',
    type: 'grafana-pyroscope-datasource',
    meta: { info: { logos: { small: '' } } },
  } as unknown as DataSourceInstanceSettings;

  const props = {
    detailState,
    span,
    traceStartTime,
    request,
    traceToProfilesOptions,
    topOfExploreViewRef,
    logItemToggle: jest.fn(),
    logsToggle: jest.fn(),
    processToggle: jest.fn(),
    tagsToggle: jest.fn(),
    summaryAttributesToggle: jest.fn(),
    warningsToggle: jest.fn(),
    referencesToggle: jest.fn(),
    createFocusSpanLink: jest.fn().mockReturnValue({}),
    traceFlameGraphs: { [span.spanID]: createDataFrame(data) },
    setRedrawListView: jest.fn(),
    timeRange: {
      from: dateTime(0),
      to: dateTime(1000000000000),
      raw: {
        from: 0,
        to: 1000000000000,
      },
    },
    datasourceType: 'tempo',
    datasourceUid: 'grafanacloud-traces',
  };

  span.tags = [
    ...span.tags,
    {
      key: pyroscopeProfileIdTagKey,
      value: span.spanID,
    },
  ];

  span.spanID = 'test-spanID';
  span.kind = 'test-kind';
  span.statusCode = 2;
  span.statusMessage = 'test-message';
  span.instrumentationLibraryName = 'test-name';
  span.instrumentationLibraryVersion = 'test-version';
  span.traceState = 'test-state';

  span.logs = [
    {
      timestamp: 10,
      fields: [
        { key: 'message', value: 'oh the log message' },
        { key: 'something', value: 'else' },
      ],
    },
    {
      timestamp: 20,
      fields: [
        { key: 'message', value: 'oh the next log message' },
        { key: 'more', value: 'stuff' },
      ],
    },
  ];

  span.warnings = ['Warning 1', 'Warning 2'];

  span.references = [
    {
      refType: 'CHILD_OF',
      span: {
        spanID: 'span2',
        traceID: 'trace1',
        operationName: 'op1',
        process: {
          serviceName: 'service1',
        },
      },
      spanID: 'span1',
      traceID: 'trace1',
    } as TraceSpanReference,
    {
      refType: 'CHILD_OF',
      span: {
        spanID: 'span3',
        traceID: 'trace1',
        operationName: 'op2',
        process: {
          serviceName: 'service2',
        },
      },
      spanID: 'span4',
      traceID: 'trace1',
    } as TraceSpanReference,
    {
      refType: 'CHILD_OF',
      span: {
        spanID: 'span6',
        traceID: 'trace2',
        operationName: 'op2',
        process: {
          serviceName: 'service2',
        },
      },
      spanID: 'span5',
      traceID: 'trace2',
    } as TraceSpanReference,
  ];

  beforeEach(() => {
    mockMeasuredWidth = 0;
    jest.mocked(formatDuration).mockReset();
    props.tagsToggle.mockReset();
    props.processToggle.mockReset();
    props.logsToggle.mockReset();
    props.logItemToggle.mockReset();
    props.summaryAttributesToggle.mockReset();

    setPluginLinksHook(() => ({
      isLoading: false,
      links: [],
    }));

    setDataSourceSrv({
      getList() {
        return [pyroSettings];
      },
      getInstanceSettings() {
        return pyroSettings;
      },
    } as unknown as DataSourceSrv);
  });

  it('renders without exploding', () => {
    expect(() => render(<SpanDetail {...(props as unknown as SpanDetailProps)} />)).not.toThrow();
  });

  describe('attribute card layout', () => {
    it('uses two columns when the container is wider than 1000px', () => {
      mockMeasuredWidth = 1200;
      render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
      expect(screen.getAllByTestId('span-detail-cards-column')).toHaveLength(2);
    });

    it('uses a single column when the container is 1000px or narrower', () => {
      mockMeasuredWidth = 800;
      render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
      expect(screen.getAllByTestId('span-detail-cards-column')).toHaveLength(1);
    });
  });

  it('shows the operation name', () => {
    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
    expect(screen.getByRole('heading', { name: span.operationName })).toBeInTheDocument();
  });

  it('lists the service name, duration, start time and kind', () => {
    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
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
    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
    const absoluteTime = getAbsoluteTime(span.startTime, 'browser');
    expect(
      screen.getByText((text) => {
        return text.includes(absoluteTime);
      })
    ).toBeInTheDocument();
  });

  it('renders the span tags', async () => {
    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
    await userEvent.click(screen.getByRole('switch', { name: /Span attributes/ }));
    expect(props.tagsToggle).toHaveBeenLastCalledWith(span.spanID);
  });

  it('renders the process tags', async () => {
    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
    await userEvent.click(screen.getByRole('switch', { name: /Resource attributes/ }));
    expect(props.processToggle).toHaveBeenLastCalledWith(span.spanID);
  });

  it('renders the logs', async () => {
    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
    await userEvent.click(screen.getByRole('switch', { name: /Events/ }));
    expect(props.logsToggle).toHaveBeenLastCalledWith(span.spanID);
    await userEvent.click(screen.getByRole('switch', { name: /oh the log/ }));
    expect(props.logItemToggle).toHaveBeenLastCalledWith(span.spanID, props.span.logs[0]);
  });

  it('renders the warnings', async () => {
    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
    await userEvent.click(screen.getByRole('switch', { name: /Warnings/ }));
    expect(props.warningsToggle).toHaveBeenLastCalledWith(span.spanID);
  });

  it('renders the references', async () => {
    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
    await userEvent.click(screen.getByRole('switch', { name: /References/ }));
    expect(props.referencesToggle).toHaveBeenLastCalledWith(span.spanID);
  });

  it('renders deep link URL', () => {
    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
    expect(screen.getByTestId('share-span-button')).toBeInTheDocument();
    expect(screen.getByText('test-spanID')).toBeInTheDocument();
  });

  it('renders the flame graph', async () => {
    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
    await act(async () => {
      expect(screen.getByText(/16.5 Bil/)).toBeInTheDocument();
      expect(screen.getByText(/(Count)/)).toBeInTheDocument();
    });
  });

  describe('summary spans', () => {
    const summarySpan = {
      ...span,
      aggregation: {
        isSummary: true,
        isPreservedOutlier: false,
        spanCount: 3,
        durationMinNs: 30_010_000,
        durationMedianNs: 168_450_000,
        durationMaxNs: 262_010_000,
      },
    };
    const summaryProps = { ...props, span: summarySpan };

    beforeEach(() => {
      jest.mocked(formatDuration).mockImplementation((duration: number) => `${duration}us`);
    });

    it('labels the span as a summary in the header', () => {
      render(<SpanDetail {...(summaryProps as unknown as SpanDetailProps)} />);
      expect(screen.getByText('(summary)')).toBeInTheDocument();
    });

    it('shows the aggregated span count', () => {
      render(<SpanDetail {...(summaryProps as unknown as SpanDetailProps)} />);
      expect(screen.getByLabelText('3 aggregated spans')).toBeInTheDocument();
    });

    it('hides the count badge when the span count is zero', () => {
      const zeroCount = { ...summarySpan.aggregation, spanCount: 0 };
      render(
        <SpanDetail
          {...({ ...summaryProps, span: { ...summarySpan, aggregation: zeroCount } } as unknown as SpanDetailProps)}
        />
      );
      expect(screen.getByText('(summary)')).toBeInTheDocument();
      expect(screen.queryByLabelText(/aggregated span/)).not.toBeInTheDocument();
    });

    it('shows min, median and max in the duration overview item', () => {
      render(<SpanDetail {...(summaryProps as unknown as SpanDetailProps)} />);
      expect(screen.getByText(/\(min\).*\(median\).*\(max\)/)).toBeInTheDocument();
    });

    it('omits median from the duration stats when it is not present', () => {
      const { durationMedianNs, ...noMedian } = summarySpan.aggregation;
      render(
        <SpanDetail
          {...({ ...summaryProps, span: { ...summarySpan, aggregation: noMedian } } as unknown as SpanDetailProps)}
        />
      );
      expect(screen.getByText(/\(min\).*\(max\)/)).toBeInTheDocument();
      expect(screen.queryByText(/\(median\)/)).not.toBeInTheDocument();
    });

    it('adds an End Time overview item', () => {
      render(<SpanDetail {...(summaryProps as unknown as SpanDetailProps)} />);
      expect(screen.getByText('End Time:')).toBeInTheDocument();
    });

    it('annotates resource attributes as inherited from the slowest span', () => {
      render(<SpanDetail {...(summaryProps as unknown as SpanDetailProps)} />);
      expect(screen.getByText('(inherited from slowest span)')).toBeInTheDocument();
    });

    it('does not show summary affordances for non-summary spans', () => {
      render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
      expect(screen.queryByText('(summary)')).not.toBeInTheDocument();
      expect(screen.queryByText('End Time:')).not.toBeInTheDocument();
      expect(screen.queryByText('(inherited from slowest span)')).not.toBeInTheDocument();
    });
  });

  describe('summary attribute tags', () => {
    const summarySpanWithTags = {
      ...span,
      aggregation: { isSummary: true, isPreservedOutlier: false, spanCount: 3 },
      tags: [
        { key: 'http.method', value: 'POST' },
        { key: 'aggregation.is_summary', value: 'true' },
        { key: 'aggregation.span_count', value: '3' },
      ],
    };
    // All accordions collapsed so each renders its abbreviated key preview.
    const summaryTagsProps = { ...props, span: summarySpanWithTags, detailState: new DetailState() };

    beforeEach(() => {
      jest.mocked(formatDuration).mockImplementation((duration: number) => `${duration}us`);
    });

    it('renders a dedicated Summary attributes accordion for summary spans', () => {
      render(<SpanDetail {...(summaryTagsProps as unknown as SpanDetailProps)} />);
      expect(screen.getByRole('switch', { name: /Summary attributes/ })).toBeInTheDocument();
    });

    it('moves aggregation.* tags out of Span attributes into Summary attributes', () => {
      render(<SpanDetail {...(summaryTagsProps as unknown as SpanDetailProps)} />);
      // The aggregation key is shown once (in the Summary attributes preview), not duplicated
      // under Span attributes.
      expect(screen.getAllByText('aggregation.span_count')).toHaveLength(1);
      expect(screen.getByText('http.method')).toBeInTheDocument();
    });

    it('toggles the Summary attributes accordion', async () => {
      render(<SpanDetail {...(summaryTagsProps as unknown as SpanDetailProps)} />);
      await userEvent.click(screen.getByRole('switch', { name: /Summary attributes/ }));
      expect(props.summaryAttributesToggle).toHaveBeenLastCalledWith(span.spanID);
    });

    it('does not render a Summary attributes accordion for non-summary spans', () => {
      render(<SpanDetail {...({ ...props, detailState: new DetailState() } as unknown as SpanDetailProps)} />);
      expect(screen.queryByRole('switch', { name: /Summary attributes/ })).not.toBeInTheDocument();
    });
  });

  it('should load plugin links for resource attributes', () => {
    const usePluginLinksMock = jest.fn().mockReturnValue({ links: [] });
    setPluginLinksHook(usePluginLinksMock);
    jest.requireMock('@grafana/runtime').usePluginLinks = usePluginLinksMock;

    render(<SpanDetail {...(props as unknown as SpanDetailProps)} />);
    expect(usePluginLinksMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          attributes: expect.objectContaining({
            'http.url': expect.arrayContaining([expect.any(String)]),
          }),
          timeRange: {
            from: 0,
            to: 1000000000000,
          },
          datasource: {
            type: 'tempo',
            uid: 'grafanacloud-traces',
          },
        }),
      })
    );
  });
});
