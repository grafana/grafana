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
    // into a "+N" counter so the title row stays compact. The chip is
    // prefixed with `#` (Phase E.4) so it reads as a tag, not as a
    // runtime alert.
    expect(screen.getByText(/#db-slow/)).toBeInTheDocument();
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
    expect(screen.queryByText(/pod-oom/)).not.toBeInTheDocument();
  });

  it('does not render the "+N" suffix when there is only a single failure mode', () => {
    renderChips({
      failureModes: [{ tag: 'db-slow' }],
    });

    expect(screen.getByText(/#db-slow/)).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('Phase E.4: declared failure-mode chip uses no warning icon (reserved for active-match in Phase F)', () => {
    const { container } = renderChips({
      failureModes: [{ tag: 'db-slow' }],
    });

    // The chip text is the only signal a declared failure mode
    // provides; rendering an exclamation-triangle here would visually
    // collide with the runtime panel-error chip (red destructive
    // button with the same icon). The red + warning treatment is
    // reserved for the live active-match state landed in Phase F.
    expect(container.querySelector('svg[name="exclamation-triangle"]')).toBeNull();
    expect(container.querySelector('[data-icon="exclamation-triangle"]')).toBeNull();
  });

  it('Phase E.4: failure-mode chip is prefixed with `#` to read as a tag rather than an alert', () => {
    renderChips({ failureModes: [{ tag: 'bot-traffic' }] });
    // The literal `#` prefix is what disambiguates "this is a label
    // the team watches for" from "the panel is failing right now".
    expect(screen.getByText('#bot-traffic')).toBeInTheDocument();
  });

  it('renders nothing without crashing when failureModes is a bare string instead of an array', () => {
    // Hand-authored or LLM-drafted intent has been observed in the
    // wild with `failureModes` set to a free-text string rather than
    // the `Array<{tag}>` shape the schema declares. Render nothing
    // for the malformed field rather than crashing the panel header
    // with `failureModes.map is not a function`.
    const { container } = renderChips({
      // @ts-expect-error — intentional malformed shape for the
      // regression test; the schema typing rejects this but real
      // dashboards in the wild contain it.
      failureModes: 'Spikes indicate runaway processes',
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing without crashing when expectedBehavior is a bare string instead of an object', () => {
    // Same shape-drift risk for `expectedBehavior` — the schema
    // expects `{normalRange?, alertThreshold?, notes?}` but legacy
    // hand-edits sometimes store a single descriptive string here.
    const { container } = renderChips({
      // @ts-expect-error — see above.
      expectedBehavior: 'All metrics should be within normal thresholds',
    });
    expect(container).toBeEmptyDOMElement();
  });
});
