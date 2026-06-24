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

  const props = {
    longLabel,
    shortLabel,
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

  it('labels the bar-side duration stats in a tooltip for summary spans', async () => {
    const summarySpan = {
      ...props.span,
      aggregation: { isSummary: true, durationMinNs: 4_000_000, durationMedianNs: 9_000_000, durationMaxNs: 60_000_000 },
    };
    render(<SpanBar {...({ ...props, span: summarySpan } as unknown as Props)} />);
    await userEvent.hover(screen.getByText(shortLabel));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Min');
    expect(tooltip).toHaveTextContent('Median');
    expect(tooltip).toHaveTextContent('Max');
  });

  it('does not show a duration-stats tooltip for normal spans', async () => {
    render(<SpanBar {...(props as unknown as Props)} />);
    await userEvent.hover(screen.getByText(shortLabel));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('keeps the stats label (does not expand to the long label) when hovering a summary span', async () => {
    const summarySpan = {
      ...props.span,
      aggregation: { isSummary: true, durationMinNs: 4_000_000, durationMaxNs: 60_000_000 },
    };
    render(<SpanBar {...({ ...props, span: summarySpan } as unknown as Props)} />);
    await userEvent.hover(screen.getByText(shortLabel));
    expect(screen.getByText(shortLabel)).toBeInTheDocument();
    expect(screen.queryByText(longLabel)).not.toBeInTheDocument();
  });
});
