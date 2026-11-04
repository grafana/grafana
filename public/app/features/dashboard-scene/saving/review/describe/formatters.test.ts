import { describeValue, displayAutoRefresh, displayTimeRange, isShort } from './formatters';
import { isUnset } from './paths';

describe('describeValue', () => {
  it.each([
    ['short → short', '1m', '30s', 'Min interval: 1m → 30s'],
    ['(not set) → short', undefined, 500, 'Min interval: set to 500'],
    ['empty string reads as not set', '', '1m', 'Min interval: set to 1m'],
    ['short → (not set)', 500, undefined, 'Min interval: cleared (was 500)'],
  ])('%s', (_, before, after, text) => {
    expect(describeValue('Min interval', before, after, { type: 'auto' })).toEqual({ kind: 'changed', text });
  });

  it('words booleans by the new value, a removed true reading as turned off', () => {
    expect(describeValue('Transparent background', undefined, true, { type: 'auto' }).text).toBe(
      'Transparent background: turned on'
    );
    expect(describeValue('Transparent background', true, false, { type: 'boolean' }).text).toBe(
      'Transparent background: turned off'
    );
    expect(describeValue('Transparent background', true, undefined, { type: 'auto' }).text).toBe(
      'Transparent background: turned off'
    );
  });

  it('quotes free text when set, renamed or cleared, but never numbers', () => {
    const text = { type: 'name', quoted: true } as const;

    expect(describeValue('Title', 'Requests', 'Request rate', text).text).toBe('Title: "Requests" → "Request rate"');
    expect(describeValue('Title', '', 'Checkout', text).text).toBe('Title: set to "Checkout"');
    expect(describeValue('Title', 'Requests', undefined, text).text).toBe('Title: cleared (was "Requests")');
    expect(describeValue('Decimals', undefined, 2, { type: 'auto', quoted: true }).text).toBe('Decimals: set to 2');
  });

  it('reads a missing boolean as the setting it stands for', () => {
    expect(describeValue('Match row heights', false, undefined, { type: 'boolean', absent: true }).text).toBe(
      'Match row heights: turned on'
    );
    expect(describeValue('Fit content', false, undefined, { type: 'boolean', absent: 'inherit' }).text).toBe(
      'Fit content: set to follow the layout'
    );
    expect(describeValue('Fit content', undefined, false, { type: 'boolean', absent: 'inherit' }).text).toBe(
      'Fit content: turned off'
    );
  });

  it('never shows a missing side', () => {
    expect(describeValue('Description', '', undefined, { type: 'freeText' })).toEqual({
      kind: 'changed',
      text: 'Description: changed',
    });
  });

  it('words long values as changed, with both sides on demand', () => {
    const before = { mode: 'absolute', steps: [{ color: 'green', value: 0 }] };
    const after = { mode: 'percentage', steps: [{ color: 'green', value: 0 }] };

    expect(describeValue('Thresholds', before, after, { type: 'auto' })).toEqual({
      kind: 'changed',
      text: 'Thresholds: changed',
      details: { before: JSON.stringify(before, null, 2), after: JSON.stringify(after, null, 2) },
    });
  });

  it('treats a string over 40 characters or with a newline as long', () => {
    const long = 'x'.repeat(41);

    expect(describeValue('Expr', 'a', long, { type: 'auto' })).toMatchObject({ text: 'Expr: changed' });
    expect(describeValue('Expr', 'a', 'b\nc', { type: 'auto' })).toMatchObject({ text: 'Expr: changed' });
  });

  it('shows free text inline up to 60 characters on one line', () => {
    expect(describeValue('Description', '', 'Golden signals', { type: 'freeText' }).text).toBe(
      'Description: set to Golden signals'
    );
    expect(describeValue('Description', 'Golden signals', undefined, { type: 'freeText' }).text).toBe(
      'Description: cleared (was Golden signals)'
    );
  });

  it('words long free text set or cleared as added or removed, with the one side it has', () => {
    const long = 'x'.repeat(61);

    expect(describeValue('Description', '', long, { type: 'freeText' })).toEqual({
      kind: 'added',
      text: 'Description: added',
      details: { after: long },
    });
    expect(describeValue('Description', 'line\nbreak', undefined, { type: 'freeText' })).toEqual({
      kind: 'removed',
      text: 'Description: removed',
      details: { before: 'line\nbreak' },
    });
    expect(describeValue('Description', 'short', long, { type: 'freeText' })).toMatchObject({
      text: 'Description: changed',
      details: { before: 'short', after: long },
    });
  });

  it('shows thresholds as readable steps, with the mode when it differs', () => {
    const steps = [
      { color: 'green', value: 0 },
      { color: 'red', value: 80 },
    ];

    expect(
      describeValue('Thresholds', { mode: 'absolute', steps }, { mode: 'percentage', steps }, { type: 'thresholds' })
    ).toEqual({
      kind: 'changed',
      text: 'Thresholds: changed',
      details: { before: 'Mode: Absolute\nBase: green\n80: red', after: 'Mode: Percentage\nBase: green\n80: red' },
    });
  });

  it('shows names inline however long', () => {
    const title = 'A very long dashboard title that is well over forty characters';

    expect(describeValue('Title', 'Short', title, { type: 'name' }).text).toBe(`Title: Short → ${title}`);
  });

  it('uses the display for values the UI shows differently', () => {
    expect(
      describeValue('Graph tooltip', 'Off', 'Crosshair', {
        type: 'name',
        display: (value) => (value === 'Off' ? 'Default' : 'Shared crosshair'),
      }).text
    ).toBe('Graph tooltip: Default → Shared crosshair');
  });

  it('reads an empty auto refresh as Off', () => {
    expect(describeValue('Auto refresh', '', '1m', { type: 'unsetIsValue', display: displayAutoRefresh }).text).toBe(
      'Auto refresh: Off → 1m'
    );
  });
});

describe('value helpers', () => {
  it('describes a time range as the time picker does', () => {
    expect(displayTimeRange('now-6h', 'now')).toBe('Last 6 hours');
    expect(displayTimeRange('now-24h', 'now')).toBe('Last 24 hours');
  });

  it('counts absent, empty strings, arrays and objects as not set', () => {
    expect([undefined, '', [], {}].every(isUnset)).toBe(true);
    expect([0, false, 'x', [1], { a: 1 }].some(isUnset)).toBe(false);
  });

  it('counts strings up to 40 characters, numbers and booleans as short', () => {
    expect(isShort('x'.repeat(40))).toBe(true);
    expect(isShort('x'.repeat(41))).toBe(false);
    expect(isShort(0)).toBe(true);
    expect(isShort(false)).toBe(true);
    expect(isShort(['a'])).toBe(false);
  });
});
