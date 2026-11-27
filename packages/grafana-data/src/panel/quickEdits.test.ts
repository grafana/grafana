import { type FieldConfigSource } from '../types/fieldOverrides';
import { ThresholdsMode } from '../types/thresholds';

import { rangeQuickEdit, thresholdsQuickEdit, unitQuickEdit } from './quickEdits';

function summarize(edit: ReturnType<typeof unitQuickEdit>, defaults: FieldConfigSource['defaults']) {
  return edit.summary?.({ options: {}, fieldConfig: { defaults, overrides: [] } });
}

describe('unitQuickEdit', () => {
  it.each([
    { desc: 'no unit', defaults: {}, text: 'None' },
    { desc: 'a unit by its display name', defaults: { unit: 'reqps' }, text: 'requests/sec (rps)' },
    { desc: 'an unknown unit by its id', defaults: { unit: 'widgets' }, text: 'widgets' },
    {
      desc: 'decimals after the unit',
      defaults: { unit: 'percent', decimals: 2 },
      text: 'Percent (0-100), 2 decimals',
    },
  ])('summarizes $desc', ({ defaults, text }) => {
    expect(summarize(unitQuickEdit(), defaults)).toEqual({ text });
  });
});

describe('rangeQuickEdit', () => {
  it.each([
    { desc: 'no limits as auto', defaults: {}, text: 'Auto' },
    { desc: 'both limits', defaults: { min: 0, max: 100 }, text: '0 – 100' },
    { desc: 'a missing limit as auto', defaults: { max: 5 }, text: 'Auto – 5' },
  ])('summarizes $desc', ({ defaults, text }) => {
    expect(summarize(rangeQuickEdit(), defaults)).toEqual({ text });
  });
});

describe('thresholdsQuickEdit', () => {
  it('lists the plugin options after the thresholds', () => {
    expect(thresholdsQuickEdit(['custom.thresholdsStyle']).optionIds).toEqual(['thresholds', 'custom.thresholdsStyle']);
  });

  it('summarizes the step values after the base and shows every step colour', () => {
    const thresholds = {
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'orange' },
        { value: 90, color: 'red' },
      ],
    };

    expect(summarize(thresholdsQuickEdit(), { thresholds })).toEqual({
      text: '80 · 90',
      swatches: ['green', 'orange', 'red'],
    });
  });

  it('marks the step values as percentages in percentage mode', () => {
    const thresholds = {
      mode: ThresholdsMode.Percentage,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 80, color: 'red' },
      ],
    };

    expect(summarize(thresholdsQuickEdit(), { thresholds })).toEqual({ text: '80%', swatches: ['green', 'red'] });
  });

  it('summarizes thresholds with only a base step as base only', () => {
    const thresholds = { mode: ThresholdsMode.Absolute, steps: [{ value: -Infinity, color: 'green' }] };

    expect(summarize(thresholdsQuickEdit(), { thresholds })).toEqual({ text: 'Base only', swatches: ['green'] });
  });
});
