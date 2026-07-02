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

import { selectors } from '@grafana/e2e-selectors';

import SpanBar, { type Props } from './SpanBar';

describe('<SpanBar>', () => {
  const shortLabel = 'omg-so-awesome';
  const longLabel = 'omg-awesome-long-label';
  const labelDetail = 'my-service::my-operation';

  const props = {
    longLabel,
    shortLabel,
    labelDetail,
    color: '#fff',
    hintSide: 'right',
    viewEnd: 1,
    viewStart: 0,
    theme: {},
    getViewedBounds: (s: number) => {
      // Log entries
      if (s === 10) {
        return { start: 0.1, end: 0.1 };
      }
      if (s === 20) {
        return { start: 0.2, end: 0.2 };
      }
      return { error: 'error' };
    },
    rpc: {
      viewStart: 0.25,
      viewEnd: 0.75,
      color: '#000',
    },
    traceStartTime: 0,
    span: {
      logs: [
        {
          timestamp: 10,
          fields: [
            { key: 'message', value: 'oh the log message' },
            { key: 'something', value: 'else' },
          ],
        },
        {
          timestamp: 10,
          fields: [
            { key: 'message', value: 'oh the second log message' },
            { key: 'something', value: 'different' },
          ],
        },
        {
          timestamp: 20,
          fields: [
            { key: 'message', value: 'oh the next log message' },
            { key: 'more', value: 'stuff' },
          ],
        },
      ],
    },
  };

  it('renders without exploding', async () => {
    render(<SpanBar {...(props as unknown as Props)} />);
    expect(screen.getByText(shortLabel)).toBeInTheDocument();
    expect(screen.queryByText(longLabel)).not.toBeInTheDocument();

    await userEvent.hover(screen.getByTestId(selectors.components.TraceViewer.spanBar));
    expect(screen.queryByText(shortLabel)).not.toBeInTheDocument();
    expect(screen.getByText(longLabel)).toBeInTheDocument();

    await userEvent.unhover(screen.getByTestId(selectors.components.TraceViewer.spanBar));
    expect(screen.getByText(shortLabel)).toBeInTheDocument();
    expect(screen.queryByText(longLabel)).not.toBeInTheDocument();
  });

  it('log markers count', () => {
    // 3 log entries, two grouped together with the same timestamp
    render(<SpanBar {...(props as unknown as Props)} />);
    expect(screen.getAllByTestId('SpanBar--logMarker')).toHaveLength(2);
  });

  it('applies the summary bar styling to summary spans', () => {
    const summarySpan = { ...props.span, aggregation: { isSummary: true } };
    render(<SpanBar {...({ ...props, span: summarySpan } as unknown as Props)} />);
    expect(screen.getByTestId('SpanBar--bar').className).toMatch(/barSummary/);
  });

  it('does not apply summary bar styling to normal spans', () => {
    render(<SpanBar {...(props as unknown as Props)} />);
    expect(screen.getByTestId('SpanBar--bar').className).not.toMatch(/barSummary/);
  });

  it('threads the service color into the summary bar gradient via a CSS variable', () => {
    const summarySpan = { ...props.span, aggregation: { isSummary: true } };
    render(<SpanBar {...({ ...props, span: summarySpan } as unknown as Props)} />);
    const bar = screen.getByTestId('SpanBar--bar');
    expect(bar.style.getPropertyValue('--span-summary-color')).toBe(props.color);
  });

  it('does not show a duration-stats tooltip for normal spans', async () => {
    render(<SpanBar {...(props as unknown as Props)} />);
    await userEvent.hover(screen.getByText(shortLabel));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps the aria-hidden summary bar free of focusable elements (guards aria-hidden-focus)', () => {
    const summarySpan = {
      ...props.span,
      aggregation: {
        isSummary: true,
        durationMinNs: 4_000_000,
        durationMedianNs: 9_000_000,
        durationMaxNs: 60_000_000,
      },
    };
    render(<SpanBar {...({ ...props, span: summarySpan } as unknown as Props)} />);
    const wrapper = screen.getByTestId(selectors.components.TraceViewer.spanBar);
    expect(wrapper).toHaveAttribute('aria-hidden', 'true');
    // A focusable trigger inside this aria-hidden subtree (e.g. Grafana's Tooltip
    // clones its child with tabIndex=0) would be keyboard-reachable while hidden
    // from assistive tech, which axe reports as aria-hidden-focus.
    expect(wrapper.querySelector('[tabindex]')).toBeNull();
  });

  it('reveals the service::operation detail on hover while keeping the stats label permanently visible', async () => {
    const summarySpan = {
      ...props.span,
      aggregation: { isSummary: true, durationMinNs: 4_000_000, durationMaxNs: 60_000_000 },
    };
    // The detail is rendered as its own span sibling (not merged into the stats label).
    const detailSpan = (content: string, el: Element | null) => el?.tagName === 'SPAN' && content.includes(labelDetail);

    render(<SpanBar {...({ ...props, span: summarySpan } as unknown as Props)} />);
    expect(screen.queryByText(detailSpan)).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText(shortLabel));
    expect(screen.getByText(shortLabel)).toBeInTheDocument();
    expect(screen.getByText(detailSpan)).toBeInTheDocument();
  });

  // detailBeforeStats = viewStart > 1 - viewEnd, mirroring SpanBarRow's longLabel
  // ordering: detail before the stats when the bar sits near the right edge,
  // after them otherwise. Both cases exercise the flip so the duplicated
  // condition cannot drift unnoticed.
  const summaryStatsSpan = {
    ...props.span,
    aggregation: { isSummary: true, durationMinNs: 4_000_000, durationMaxNs: 60_000_000 },
  };

  it('orders the detail before the stats when the bar sits near the right edge', async () => {
    // viewStart (0.9) > 1 - viewEnd (0) -> detail before stats
    render(<SpanBar {...({ ...props, viewStart: 0.9, viewEnd: 1, span: summaryStatsSpan } as unknown as Props)} />);
    await userEvent.hover(screen.getByText(shortLabel));
    const text = screen.getByTestId('SpanBar--label').textContent ?? '';
    expect(text.indexOf(labelDetail)).toBeLessThan(text.indexOf(shortLabel));
  });

  it('orders the detail after the stats when the bar sits near the left edge', async () => {
    // viewStart (0) <= 1 - viewEnd (0.8) -> detail after stats
    render(<SpanBar {...({ ...props, viewStart: 0, viewEnd: 0.2, span: summaryStatsSpan } as unknown as Props)} />);
    await userEvent.hover(screen.getByText(shortLabel));
    const text = screen.getByTestId('SpanBar--label').textContent ?? '';
    expect(text.indexOf(labelDetail)).toBeGreaterThan(text.indexOf(shortLabel));
  });
});
