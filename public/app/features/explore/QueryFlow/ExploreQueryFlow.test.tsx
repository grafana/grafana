import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getDefaultTimeRange } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { useSelector } from 'app/types/store';

import { ExploreQueryFlow } from './ExploreQueryFlow';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('app/types/store', () => ({
  useSelector: jest.fn(),
}));

function mockPane(overrides: {
  queries?: Array<Record<string, unknown>>;
  datasourceInstance?: Record<string, unknown>;
}) {
  // Built once so every selector call sees the same references (the real store is referentially
  // stable too) — a fresh `getDefaultTimeRange()` per call resolves "now" again and would make
  // range-derived hook inputs change on every render.
  const state = {
    explore: {
      panes: {
        left: {
          queries: overrides.queries,
          datasourceInstance: overrides.datasourceInstance,
          range: getDefaultTimeRange(),
          queryResponse: undefined,
        },
      },
    },
  };
  (useSelector as jest.Mock).mockImplementation((selector) => selector(state));
}

describe('ExploreQueryFlow', () => {
  it('wires the active query through parsing, diagnostics, and rendering end to end', () => {
    mockPane({ queries: [{ refId: 'A', expr: 'rate(metric{job="api"}[5m])', datasource: { type: 'prometheus' } }] });

    render(<ExploreQueryFlow exploreId="left" refId="A" onClose={jest.fn()} />);

    expect(screen.getByText('rate')).toBeInTheDocument();
    expect(screen.getByText('metric')).toBeInTheDocument();
  });

  it('shows the unsupported state for a datasource with no mapper', () => {
    mockPane({ queries: [{ refId: 'A', expr: 'select 1', datasource: { type: 'postgres' } }] });

    render(<ExploreQueryFlow exploreId="left" refId="A" onClose={jest.fn()} />);

    expect(screen.getByText(/supports Prometheus and Loki/i)).toBeInTheDocument();
  });

  it('shows the empty-query prompt when the query has no expr', () => {
    mockPane({ queries: [{ refId: 'A', expr: '', datasource: { type: 'prometheus' } }] });

    render(<ExploreQueryFlow exploreId="left" refId="A" onClose={jest.fn()} />);

    expect(screen.getByText(/Enter a Prometheus or Loki query/i)).toBeInTheDocument();
  });

  it('reports a close-time summary with real error/tip counts, then calls onClose', async () => {
    (reportInteraction as jest.Mock).mockClear();
    const onClose = jest.fn();
    // `rate(metric)` triggers the range-vector error (no `[..]`) and, once fixed conceptually, would
    // also have an unaggregated-rate tip — using it as-is exercises the real diagnostics pipeline.
    mockPane({ queries: [{ refId: 'A', expr: 'rate(metric)', datasource: { type: 'prometheus' } }] });

    render(<ExploreQueryFlow exploreId="left" refId="A" onClose={onClose} />);

    await userEvent.click(screen.getByLabelText('Close query flow'));

    expect(reportInteraction).toHaveBeenCalledWith(
      'grafana_explore_query_flow_close',
      expect.objectContaining({ status: 'valid', errorCount: expect.any(Number), tipCount: expect.any(Number) })
    );
    const [, payload] = (reportInteraction as jest.Mock).mock.calls[0];
    expect(payload.errorCount).toBeGreaterThan(0);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
