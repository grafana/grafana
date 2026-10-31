import { ThresholdsMode } from '@grafana/data';
import { ScaleDistribution } from '@grafana/schema';

import { getBarGaugeScaleLabels, placeScaleLabels } from './BarGaugeScaleLabels';

describe('getBarGaugeScaleLabels', () => {
  it('labels min, max and the absolute thresholds inside the range', () => {
    const labels = getBarGaugeScaleLabels({
      min: 0,
      max: 100,
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 40, color: 'orange' },
          { value: 60, color: 'red' },
          { value: 200, color: 'purple' },
        ],
      },
    });

    expect(labels).toEqual([
      { text: '0', percent: 0 },
      { text: '100', percent: 1 },
      { text: '40', percent: 0.4 },
      { text: '60', percent: 0.6 },
    ]);
  });

  it('shows percentage thresholds as a percentage at the value they resolve to', () => {
    const labels = getBarGaugeScaleLabels({
      min: 50,
      max: 150,
      thresholds: {
        mode: ThresholdsMode.Percentage,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 25, color: 'red' },
        ],
      },
    });

    expect(labels[2]).toEqual({ text: '25%', percent: 0.25 });
  });

  it('adds each power of ten on a log scale after min, max and thresholds, without duplicates', () => {
    const labels = getBarGaugeScaleLabels({
      min: 1,
      max: 10000,
      custom: { scaleDistribution: { type: ScaleDistribution.Log } },
      thresholds: {
        mode: ThresholdsMode.Absolute,
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 100, color: 'orange' },
          { value: 300, color: 'red' },
        ],
      },
    });

    expect(labels.map((label) => label.text)).toEqual(['1', '10000', '100', '300', '10', '1000']);
    expect(labels.map((label) => Number(label.percent.toFixed(4)))).toEqual([0, 1, 0.5, 0.6193, 0.25, 0.75]);
  });

  it('formats labels with the display processor', () => {
    const display = jest.fn((value: unknown) => ({ numeric: Number(value), text: `${value} mbar` }));
    const labels = getBarGaugeScaleLabels({ min: 0, max: 10 }, display);

    expect(labels.map((label) => label.text)).toEqual(['0 mbar', '10 mbar']);
  });

  it('returns no labels when min equals max', () => {
    expect(getBarGaugeScaleLabels({ min: 5, max: 5 })).toEqual([]);
  });
});

describe('placeScaleLabels', () => {
  const tenWide = () => 10;

  it('centers a label on its position', () => {
    expect(placeScaleLabels([{ text: 'a', percent: 0.5 }], 100, tenWide)).toEqual([
      { text: 'a', offset: 45, size: 10 },
    ]);
  });

  it('keeps labels at the ends inside the bar', () => {
    const placed = placeScaleLabels(
      [
        { text: 'min', percent: 0 },
        { text: 'max', percent: 1 },
      ],
      100,
      tenWide
    );

    expect(placed.map((label) => label.offset)).toEqual([0, 90]);
  });

  it('drops a label that would overlap an earlier one, keeping the next one that fits', () => {
    // 'a' covers 45-55, so with a 4px gap the next label can start at 59
    const placed = placeScaleLabels(
      [
        { text: 'a', percent: 0.5 },
        { text: 'b', percent: 0.6 },
        { text: 'c', percent: 0.64 },
      ],
      100,
      tenWide
    );

    expect(placed.map((label) => label.text)).toEqual(['a', 'c']);
  });

  it('drops labels longer than the bar', () => {
    expect(placeScaleLabels([{ text: 'a', percent: 0.5 }], 8, tenWide)).toEqual([]);
  });
});
