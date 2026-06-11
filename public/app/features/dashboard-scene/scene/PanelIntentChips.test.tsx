import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataFrame, FieldType } from '@grafana/data';
import { type Panel } from '@grafana/schema';

import { PanelIntentChips, PanelIntentChipsRenderer, computeActiveMatch, computeChipStates } from './PanelIntentChips';

jest.mock('@grafana/assistant', () => ({
  useAssistant: () => ({ isAvailable: false, openAssistant: undefined }),
  createAssistantContextItem: jest.fn(),
}));

type PanelIntent = NonNullable<Panel['intent']>;

function renderChips(intent: PanelIntent, activeMatch?: { since: number }) {
  const chips = new PanelIntentChips({ intent, activeMatch });
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
      expectedBehavior: { normalRange: '10–20 logins/min', alertThreshold: '> 50' },
    });
    expect(screen.getByText(/10–20 logins\/min/)).toBeInTheDocument();
    expect(screen.getByText(/> 50/)).toBeInTheDocument();
  });

  it('renders primary failure mode chip with # prefix', () => {
    renderChips({
      failureModes: [{ tag: 'oom', description: 'Out of memory' }],
    });
    expect(screen.getByText('#oom')).toBeInTheDocument();
  });

  it('does not render an exclamation-triangle icon in failure-mode chips', () => {
    renderChips({
      failureModes: [{ tag: 'spike' }],
    });
    // The icon element should NOT be present (E.4: no warning icon on failure-mode chips)
    expect(screen.queryByRole('img', { name: /exclamation/i })).not.toBeInTheDocument();
  });

  it('shows +N suffix when there are additional failure modes', () => {
    renderChips({
      failureModes: [
        { tag: 'spike' },
        { tag: 'oom' },
        { tag: 'timeout' },
      ],
    });
    expect(screen.getByText('#spike +2')).toBeInTheDocument();
  });

  it('lists every failure mode tag (without descriptions) in the hover tooltip', async () => {
    renderChips({
      failureModes: [
        { tag: 'spike', description: 'Sudden burst' },
        { tag: 'oom', description: 'Out of memory' },
        { tag: 'timeout' },
      ],
    });

    await userEvent.hover(screen.getByText('#spike +2'));

    // Tooltip lists all tags, comma-separated, no descriptions.
    expect(await screen.findByText('#spike, #oom, #timeout')).toBeInTheDocument();
    expect(screen.queryByText(/Out of memory/)).not.toBeInTheDocument();
  });

  describe('active failure-mode match (Phase F-lite)', () => {
    it('renders the active-match chip with a bolt icon when activeMatch is set', () => {
      renderChips({ failureModes: [{ tag: 'spike' }] }, { since: Date.UTC(2026, 0, 1, 15, 13) });
      expect(screen.getByTestId('panel-intent-active-match')).toBeInTheDocument();
    });

    it('lists matched tags and breach time in the popover, no Investigate when assistant unavailable', async () => {
      renderChips(
        { failureModes: [{ tag: 'spike' }, { tag: 'oom' }] },
        { since: Date.UTC(2026, 0, 1, 15, 13) }
      );

      await userEvent.hover(screen.getByTestId('panel-intent-active-match'));

      expect(await screen.findByText('Matches #spike, #oom')).toBeInTheDocument();
      expect(screen.getByText(/Alert threshold breached since/)).toBeInTheDocument();
      // Assistant is mocked unavailable, so no Investigate shortcut.
      expect(screen.queryByRole('button', { name: /Investigate/i })).not.toBeInTheDocument();
    });

    it('falls back to the quiet chip when there is no active match', () => {
      renderChips({ failureModes: [{ tag: 'spike' }] });
      expect(screen.queryByTestId('panel-intent-active-match')).not.toBeInTheDocument();
      expect(screen.getByText('#spike')).toBeInTheDocument();
    });
  });

  describe('computeActiveMatch', () => {
    it('matches when alerting and at least one failure mode is declared', () => {
      const result = computeActiveMatch({ alert: 'alerting' }, [{ tag: 'spike' }], undefined, 1000);
      expect(result).toEqual({ since: 1000 });
    });

    it('does not match when alerting but no failure modes are declared', () => {
      expect(computeActiveMatch({ alert: 'alerting' }, [], undefined, 1000)).toBeUndefined();
    });

    it('does not match when not alerting, even with failure modes', () => {
      expect(computeActiveMatch({ alert: 'normal' }, [{ tag: 'spike' }], undefined, 1000)).toBeUndefined();
      expect(computeActiveMatch({ range: 'warning' }, [{ tag: 'spike' }], undefined, 1000)).toBeUndefined();
      expect(computeActiveMatch(undefined, [{ tag: 'spike' }], undefined, 1000)).toBeUndefined();
    });

    it('preserves the original since timestamp across recomputes while still breaching', () => {
      const prev = { since: 500 };
      const result = computeActiveMatch({ alert: 'alerting' }, [{ tag: 'spike' }], prev, 2000);
      expect(result).toEqual({ since: 500 });
    });

    it('clears the match once the panel returns below the threshold', () => {
      const prev = { since: 500 };
      expect(computeActiveMatch({ alert: 'normal' }, [{ tag: 'spike' }], prev, 2000)).toBeUndefined();
    });
  });

  it('renders nothing without crashing when failureModes is a bare string', () => {
    // Regression: observed failureModes arriving as a string in the wild,
    // which caused `failureModes.map is not a function`.
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

// ---------------------------------------------------------------------------
// computeThresholdState (Phase E.5)
// ---------------------------------------------------------------------------

function makeFrame(values: number[]): DataFrame {
  return {
    fields: [
      { type: FieldType.time, name: 'time', values: values.map((_, i) => i * 1000), config: {} },
      { type: FieldType.number, name: 'value', values, config: {} },
    ],
    length: values.length,
  };
}

describe('computeChipStates', () => {
  it('returns undefined when intent has no parseable thresholds', () => {
    const intent: PanelIntent = { expectedBehavior: { alertThreshold: 'spike' } };
    expect(computeChipStates(intent, [makeFrame([60, 70, 80])])).toBeUndefined();
  });

  it('returns undefined when series is empty', () => {
    const intent: PanelIntent = { expectedBehavior: { alertThreshold: '> 80' } };
    expect(computeChipStates(intent, [])).toBeUndefined();
  });

  it('alert chip is alerting when last value exceeds a > threshold', () => {
    const intent: PanelIntent = { expectedBehavior: { alertThreshold: '> 80' } };
    expect(computeChipStates(intent, [makeFrame([60, 70, 85])])?.alert).toBe('alerting');
  });

  it('alert chip is normal when last value is below a > threshold', () => {
    const intent: PanelIntent = { expectedBehavior: { alertThreshold: '> 80' } };
    expect(computeChipStates(intent, [makeFrame([60, 70, 75])])?.alert).toBe('normal');
  });

  it('alert chip is alerting when last value breaches a < threshold', () => {
    const intent: PanelIntent = { expectedBehavior: { alertThreshold: '< 10' } };
    expect(computeChipStates(intent, [makeFrame([50, 30, 5])])?.alert).toBe('alerting');
  });

  it('range chip is normal when last value is within the normal range', () => {
    const intent: PanelIntent = { expectedBehavior: { normalRange: '60-90' } };
    expect(computeChipStates(intent, [makeFrame([65, 70, 75])])?.range).toBe('normal');
  });

  it('range chip is warning when last value is outside the normal range', () => {
    const intent: PanelIntent = { expectedBehavior: { normalRange: '60-90' } };
    expect(computeChipStates(intent, [makeFrame([65, 70, 95])])?.range).toBe('warning');
  });

  it('chips are independent: range warning + alert normal when outside band but below threshold', () => {
    const intent: PanelIntent = { expectedBehavior: { normalRange: '60-90', alertThreshold: '> 95' } };
    const states = computeChipStates(intent, [makeFrame([70, 80, 92])]);
    expect(states?.range).toBe('warning');  // outside 60-90
    expect(states?.alert).toBe('normal');   // below 95 threshold
  });

  it('chips are independent: both alerting when threshold breached and outside range', () => {
    const intent: PanelIntent = { expectedBehavior: { normalRange: '60-90', alertThreshold: '> 90' } };
    const states = computeChipStates(intent, [makeFrame([70, 80, 92])]);
    expect(states?.range).toBe('warning');   // outside 60-90
    expect(states?.alert).toBe('alerting');  // above 90
  });

  it('uses worst-case (max) across multiple series for > thresholds', () => {
    const intent: PanelIntent = { expectedBehavior: { alertThreshold: '> 80' } };
    const series = [makeFrame([60, 65, 70]), makeFrame([75, 78, 82])];
    expect(computeChipStates(intent, series)?.alert).toBe('alerting');
  });

  it('uses worst-case (min) across multiple series for < thresholds', () => {
    const intent: PanelIntent = { expectedBehavior: { alertThreshold: '< 10' } };
    const series = [makeFrame([50, 40, 20]), makeFrame([30, 15, 8])];
    expect(computeChipStates(intent, series)?.alert).toBe('alerting');
  });
});
