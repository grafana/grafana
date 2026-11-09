import { standardEditorsRegistry, standardFieldConfigEditorRegistry } from '@grafana/data';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';
import { plugin as timeseries } from 'app/plugins/panel/timeseries/module';

import { humanizeKey } from '../richText';

import { isUnset } from './paths';
import {
  describeValue,
  displayAutoRefresh,
  displayColorScheme,
  displayTimeRange,
  getPanelLabels,
  humanizePath,
  isShort,
  isStandardTextFieldConfig,
  joinLabel,
  type Worded,
} from './wording';

// --- Labels ---

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

describe('humanized labels', () => {
  it.each([
    ['showLegend', 'Show legend'],
    ['maxDataPoints', 'Max data points'],
    ['expr', 'Expr'],
    ['legendFormat', 'Legend format'],
  ])('%s → %s', (key, label) => {
    expect(humanizeKey(key)).toBe(label);
  });

  it('joins path segments with ›', () => {
    expect(humanizePath(['legend', 'displayMode'])).toBe('Legend › Display mode');
    expect(humanizePath(['tooltip', 'hideZeros'])).toBe('Tooltip › Hide zeros');
  });

  it('unescapes JSON-pointer segments for display', () => {
    expect(humanizePath(['a~1b'])).toBe('A/b');
  });

  it('does not repeat a name equal to its category', () => {
    expect(joinLabel(['Thresholds', 'Thresholds'])).toBe('Thresholds');
  });
});

describe('displayColorScheme', () => {
  it('names a color mode as the picker does, with the color of a single color', () => {
    expect(displayColorScheme({ mode: 'thresholds' })).toBe('From thresholds');
    expect(displayColorScheme({ mode: 'fixed', fixedColor: 'red' })).toBe('Single color (red)');
    expect(displayColorScheme({ mode: 'made-up' })).toBe('made-up');
  });
});

describe('getPanelLabels', () => {
  beforeAll(() => {
    timeseries.meta = { ...timeseries.meta, id: 'timeseries', name: 'Time series' };
  });

  it('labels plugin options with their editor category and name', () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.option(['legend', 'displayMode'])).toMatchObject({
      path: ['legend', 'displayMode'],
      label: 'Legend › Mode',
    });
    expect(labels.option(['tooltip', 'hideZeros'])?.label).toBe('Tooltip › Hide zeros');
  });

  it('takes the longest option path that prefixes a deeper path', () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.option(['legend', 'calcs', '0'])).toMatchObject({ path: ['legend', 'calcs'] });
  });

  it('names a path above several options by the category they share', () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.optionGroup(['legend'])?.label).toBe('Legend');
    expect(labels.option(['legend'])).toBeUndefined();
  });

  it('labels field config with the registry category and name, standard and custom', () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.fieldConfig(['unit'])?.label).toBe('Standard options › Unit');
    expect(labels.fieldConfig(['custom', 'lineWidth'])?.label).toBe('Graph styles › Line width');
    expect(labels.fieldConfig(['thresholds', 'steps', '1', 'value'])).toMatchObject({
      path: ['thresholds'],
      label: 'Thresholds',
    });
  });

  it("shows option values in the editor's words: choice labels and unit names", () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.option(['legend', 'displayMode'])?.display?.('table')).toBe('Table');
    expect(labels.option(['legend', 'displayMode'])?.display?.('unknown')).toBeUndefined();
    expect(labels.fieldConfig(['unit'])?.display?.('none')).toBe('Number');
    expect(labels.fieldConfig(['unit'])?.display?.('percent')).toBe('Percent (0-100)');
  });

  it('knows which field config values are typed into a text box', () => {
    const labels = getPanelLabels(timeseries, {}, {});

    expect(labels.fieldConfig(['displayName'])?.textInput).toBe(true);
    expect(labels.fieldConfig(['custom', 'axisLabel'])?.textInput).toBe(true);
    expect(labels.fieldConfig(['unit'])?.textInput).toBe(false);
    expect(isStandardTextFieldConfig('noValue')).toBe(true);
    expect(isStandardTextFieldConfig('unit')).toBe(false);
  });

  it('knows no labels without a plugin', () => {
    const labels = getPanelLabels(undefined, {}, {});

    expect(labels.option(['legend', 'displayMode'])).toBeUndefined();
    expect(labels.optionGroup(['legend'])).toBeUndefined();
    expect(labels.fieldConfig(['unit'])).toBeUndefined();
  });
});

// --- Formatters ---

/** A change as the UI shows it once its Show is clicked. */
const shown = ({ details, ...worded }: Worded) => ({
  ...worded,
  ...(details && { details: { before: details.before?.(), after: details.after?.() } }),
});

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

    expect(shown(describeValue('Thresholds', before, after, { type: 'auto' }))).toEqual({
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

    expect(shown(describeValue('Description', '', long, { type: 'freeText' }))).toEqual({
      kind: 'added',
      text: 'Description: added',
      details: { after: long },
    });
    expect(shown(describeValue('Description', 'line\nbreak', undefined, { type: 'freeText' }))).toEqual({
      kind: 'removed',
      text: 'Description: removed',
      details: { before: 'line\nbreak' },
    });
    expect(shown(describeValue('Description', 'short', long, { type: 'freeText' }))).toMatchObject({
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
      shown(
        describeValue('Thresholds', { mode: 'absolute', steps }, { mode: 'percentage', steps }, { type: 'thresholds' })
      )
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
