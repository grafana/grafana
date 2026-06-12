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

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DURATION, NONE, TAG } from '@grafana/o11y-ds-frontend';

import {
  summaryDefaultsOnly,
  summaryWithConditionalAttrs,
} from '../model/pruned-spans.fixture';
import transformTraceData from '../model/transform-trace-data';
import { type SpanLinkDef } from '../types/links';
import { type TraceResponse, type TraceSpan } from '../types/trace';

import SpanBarRow, { type SpanBarRowProps } from './SpanBarRow';

function summarySpanFromFixture(fixture: TraceResponse): TraceSpan {
  const trace = transformTraceData(structuredClone(fixture))!;
  return trace.spans.find((s) => s.aggregation?.isSummary)!;
}

describe('<SpanBarRow>', () => {
  const spanID = 'some-id';
  const props = {
    addHoverIndentGuideId: jest.fn(),
    className: 'a-class-name',
    color: 'color-a',
    columnDivision: '0.5',
    hoverIndentGuideIds: new Set(),
    isChildrenExpanded: true,
    isDetailExpanded: false,
    isFilteredOut: false,
    onDetailToggled: jest.fn(),
    onChildrenToggled: jest.fn(),
    operationName: 'op-name',
    numTicks: 5,
    rpc: {
      viewStart: 0.25,
      viewEnd: 0.75,
      color: 'color-b',
      operationName: 'rpc-op-name',
      serviceName: 'rpc-service-name',
    },
    showErrorIcon: false,
    getViewedBounds: () => ({ start: 0, end: 1 }),
    span: {
      duration: 9000,
      hasChildren: true,
      process: {
        serviceName: 'service-name',
      },
      spanID,
      logs: [],
      references: [],
    },
  };

  beforeEach(() => {
    props.onDetailToggled.mockReset();
    props.onChildrenToggled.mockReset();
  });

  it('renders without exploding', () => {
    expect(() => render(<SpanBarRow {...(props as unknown as SpanBarRowProps)} />)).not.toThrow();
  });

  it('escalates detail toggling', async () => {
    render(<SpanBarRow {...(props as unknown as SpanBarRowProps)} />);
    const { onDetailToggled } = props;
    expect(onDetailToggled.mock.calls.length).toBe(0);
    await userEvent.click(screen.getByTestId('span-view'));
    expect(onDetailToggled.mock.calls).toEqual([[spanID]]);
  });

  it('escalates children toggling', async () => {
    render(<SpanBarRow {...(props as unknown as SpanBarRowProps)} />);
    const { onChildrenToggled } = props;
    expect(onChildrenToggled.mock.calls.length).toBe(0);
    await userEvent.click(screen.getByTestId('icon-wrapper'));
    expect(onChildrenToggled.mock.calls.length).toBe(1);
  });

  it('render references button', () => {
    render(<SpanBarRow {...(props as unknown as SpanBarRowProps)} />);
    const newSpan = Object.assign({}, props.span);
    const span = Object.assign(newSpan, {
      references: [
        {
          refType: 'FOLLOWS_FROM',
          traceID: 'trace1',
          spanID: 'span0',
          span: {
            spanID: 'span0',
          },
        },
        {
          refType: 'FOLLOWS_FROM',
          traceID: 'otherTrace',
          spanID: 'span1',
          span: {
            spanID: 'span1',
          },
        },
      ],
    }) as unknown as TraceSpan;

    render(
      <SpanBarRow
        {...(props as unknown as SpanBarRowProps)}
        span={span}
        createSpanLink={() => [{ href: 'href' }, { href: 'href' }] as SpanLinkDef[]}
      />
    );
    expect(screen.getAllByTestId('SpanLinksMenu')).toHaveLength(1);
  });

  it('render referenced to by single span', () => {
    render(<SpanBarRow {...(props as unknown as SpanBarRowProps)} />);
    const span = Object.assign(
      {
        subsidiarilyReferencedBy: [
          {
            refType: 'FOLLOWS_FROM',
            traceID: 'trace1',
            spanID: 'span0',
            span: {
              spanID: 'span0',
            },
          },
        ],
      },
      props.span
    ) as unknown as TraceSpan;
    render(
      <SpanBarRow
        {...(props as unknown as SpanBarRowProps)}
        span={span}
        createSpanLink={() => [{ content: 'This span is referenced by another span', href: 'href' }] as SpanLinkDef[]}
      />
    );
    expect(screen.getByRole('link', { name: 'This span is referenced by another span' })).toBeInTheDocument();
  });

  it('shows adaptive traces restored info icon when span has grafana.adaptivetraces.restored=true', () => {
    const span = {
      ...props.span,
      tags: [{ key: 'grafana.adaptivetraces.restored', value: 'true' }],
    } as unknown as TraceSpan;
    render(<SpanBarRow {...(props as unknown as SpanBarRowProps)} span={span} />);
    expect(screen.getByTestId('SpanBarRow-adaptiveTracesRestored')).toBeInTheDocument();
  });

  it('does not show adaptive traces restored icon without the tag', () => {
    const span = {
      ...props.span,
      tags: [{ key: 'other.tag', value: 'true' }],
    } as unknown as TraceSpan;
    render(<SpanBarRow {...(props as unknown as SpanBarRowProps)} span={span} />);
    expect(screen.queryByTestId('SpanBarRow-adaptiveTracesRestored')).not.toBeInTheDocument();
  });

  it('render referenced to by multiple span', () => {
    render(<SpanBarRow {...(props as unknown as SpanBarRowProps)} />);
    const span = Object.assign(
      {
        subsidiarilyReferencedBy: [
          {
            refType: 'FOLLOWS_FROM',
            traceID: 'trace1',
            spanID: 'span0',
            span: {
              spanID: 'span0',
            },
          },
          {
            refType: 'FOLLOWS_FROM',
            traceID: 'trace1',
            spanID: 'span1',
            span: {
              spanID: 'span1',
            },
          },
        ],
      },
      props.span
    ) as unknown as TraceSpan;
    render(
      <SpanBarRow
        {...(props as unknown as SpanBarRowProps)}
        span={span}
        createSpanLink={() => [{ href: 'href' }, { href: 'href' }] as SpanLinkDef[]}
      />
    );
    expect(screen.getAllByTestId('SpanLinksMenu')).toHaveLength(1);
  });

  describe('render span bar label', () => {
    it('with default value', () => {
      render(<SpanBarRow {...(props as unknown as SpanBarRowProps)} />);
      expect(screen.getByText('(9ms)')).toBeInTheDocument();
    });

    it('with none value', () => {
      const testProps = Object.assign(
        {
          spanBarOptions: {
            type: NONE,
          },
        },
        props
      );
      render(<SpanBarRow {...(testProps as unknown as SpanBarRowProps)} />);
      expect(screen.queryByText('(9ms)')).not.toBeInTheDocument();
    });

    it('with duration value', () => {
      const testProps = Object.assign(
        {
          spanBarOptions: {
            type: DURATION,
          },
        },
        props
      );
      render(<SpanBarRow {...(testProps as unknown as SpanBarRowProps)} />);
      expect(screen.getByText('(9ms)')).toBeInTheDocument();
    });

    it('with tag value', () => {
      const testProps = Object.assign(
        {
          spanBarOptions: {
            type: TAG,
            tag: 'tag',
          },
        },
        {
          ...props,
          span: {
            process: {},
            tags: [
              {
                key: 'tag',
                value: 'tag-value',
              },
            ],
          },
        }
      );
      render(<SpanBarRow {...(testProps as unknown as SpanBarRowProps)} />);
      expect(screen.getByText('(tag-value)')).toBeInTheDocument();
    });

    it('with process value', () => {
      let testProps = Object.assign(
        {
          spanBarOptions: {
            type: TAG,
            tag: 'tag',
          },
        },
        {
          ...props,
          span: {
            process: {
              tags: [
                {
                  key: 'tag',
                  value: 'process-value',
                },
              ],
            },
            tags: [],
          },
        }
      );
      render(<SpanBarRow {...(testProps as unknown as SpanBarRowProps)} />);
      expect(screen.getByText('(process-value)')).toBeInTheDocument();
    });
  });

  describe('summary spans', () => {
    // A real (parseable) service color; the shared `color-a` placeholder is not a valid
    // CSS color and breaks the badge's contrast-text calculation.
    const summaryProps = { ...props, color: '#FF780A' };

    it('renders a count badge with the aggregated span_count', () => {
      const span = summarySpanFromFixture(summaryDefaultsOnly); // span_count = 8
      render(<SpanBarRow {...(summaryProps as unknown as SpanBarRowProps)} span={span} />);
      const badge = screen.getByTestId('SpanBarRow--summaryCountBadge');
      expect(badge).toHaveTextContent('8');
      expect(badge).toHaveAccessibleName('8 aggregated spans');
    });

    it('renders (min | median | max) duration stats when median is present', () => {
      // min 4ms, median 9ms, max 60ms (raw ns in fixture)
      const span = summarySpanFromFixture(summaryWithConditionalAttrs);
      render(<SpanBarRow {...(summaryProps as unknown as SpanBarRowProps)} span={span} />);
      expect(screen.getByText('(4ms | 9ms | 60ms)')).toBeInTheDocument();
    });

    it('falls back to (min | max) when median is absent', () => {
      // summaryDefaultsOnly: min 4ms, max 60ms, no median
      const span = summarySpanFromFixture(summaryDefaultsOnly);
      render(<SpanBarRow {...(summaryProps as unknown as SpanBarRowProps)} span={span} />);
      expect(screen.getByText('(4ms | 60ms)')).toBeInTheDocument();
    });

    it('shows summary stats even when spanBarOptions type is NONE', () => {
      const span = summarySpanFromFixture(summaryWithConditionalAttrs);
      const testProps = { ...summaryProps, spanBarOptions: { type: NONE }, span };
      render(<SpanBarRow {...(testProps as unknown as SpanBarRowProps)} />);
      expect(screen.getByText('(4ms | 9ms | 60ms)')).toBeInTheDocument();
    });

    it('falls back to the single wall-clock duration when min/max are absent', () => {
      // isSummary with no duration_*_ns extracted -> degrade to formatDuration(span.duration).
      const span = {
        ...props.span,
        aggregation: { isSummary: true, isPreservedOutlier: false, spanCount: 3 },
      } as unknown as TraceSpan;
      render(<SpanBarRow {...(summaryProps as unknown as SpanBarRowProps)} span={span} />);
      expect(screen.getByText('(9ms)')).toBeInTheDocument();
    });

    it('does not render a count badge for normal (non-summary) spans', () => {
      render(<SpanBarRow {...(props as unknown as SpanBarRowProps)} />);
      expect(screen.queryByTestId('SpanBarRow--summaryCountBadge')).not.toBeInTheDocument();
    });

    it('renders the stat string (no parens) on the span bar itself', () => {
      const span = summarySpanFromFixture(summaryWithConditionalAttrs);
      render(<SpanBarRow {...(summaryProps as unknown as SpanBarRowProps)} span={span} />);
      expect(screen.getByTestId('SpanBar--label')).toHaveTextContent('4ms | 9ms | 60ms');
    });
  });
});
