import { render, screen } from '@testing-library/react';

import { type Panel } from '@grafana/schema';

import { PanelIntentChips, PanelIntentChipsRenderer } from './PanelIntentChips';

type PanelIntent = NonNullable<Panel['intent']>;

function renderChips(intent: PanelIntent) {
  const chips = new PanelIntentChips({ intent });
  // Render the renderer directly so we don't need to stand up a full
  // VizPanel + plugin import setup in the test. The parent-check
  // invariant in PanelIntentChips#onActivate is exercised in the
  // serialization tests (which mount real VizPanels).
  return render(<PanelIntentChipsRenderer model={chips} />);
}

describe('PanelIntentChips', () => {
  it('renders nothing when the intent block has no chip-worthy content', () => {
    // Purpose-only intent is surfaced in the dashboard summary bar /
    // edit-mode section, not in the panel header. The chips row should
    // collapse rather than render an empty container.
    const { container } = renderChips({ purpose: 'Track checkout p99.' });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders normal-range and alert-threshold chips', () => {
    renderChips({
      expectedBehavior: {
        normalRange: 'p99 < 250ms',
        alertThreshold: 'p99 > 500ms for 5m',
      },
      provenance: {
        'expected_behavior.normal_range': 'author-written',
        'expected_behavior.alert_threshold': 'lifted-from-alert',
      },
    });

    expect(screen.getByTestId('panel-intent-chips')).toBeInTheDocument();
    expect(screen.getByText(/p99 < 250ms/)).toBeInTheDocument();
    expect(screen.getByText(/p99 > 500ms for 5m/)).toBeInTheDocument();
  });

  it('renders the primary failure mode with a "+N" count for additional modes', () => {
    renderChips({
      failureModes: [
        { tag: 'db-slow', description: 'Database query latency spike.' },
        { tag: 'pod-oom' },
        { tag: 'deploy-regression' },
      ],
      provenance: { failure_modes: 'assistant-unconfirmed' },
    });

    // Only the primary failure mode is shown by name; the rest collapse
    // into a "+N" counter so the title row stays compact.
    expect(screen.getByText(/db-slow/)).toBeInTheDocument();
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
    expect(screen.queryByText(/pod-oom/)).not.toBeInTheDocument();
  });

  it('does not render the "+N" suffix when there is only a single failure mode', () => {
    renderChips({
      failureModes: [{ tag: 'db-slow' }],
    });

    expect(screen.getByText(/db-slow/)).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });
});
