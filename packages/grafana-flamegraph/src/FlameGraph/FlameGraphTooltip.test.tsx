import { Field, FieldType, createDataFrame } from '@grafana/data';

import { getDiffTooltipData, getTooltipData } from './FlameGraphTooltip';
import { FlameGraphDataContainer } from './dataTransform';

function setupData(unit?: string) {
  const flameGraphData = createDataFrame({
    fields: [
      { name: 'level', values: [0] },
      unit ? makeField('value', unit, [8_624_078_250]) : { name: 'value', values: [8_624_078_250] },
      { name: 'self', values: [978_250] },
      { name: 'label', values: ['total'] },
    ],
  });
  return new FlameGraphDataContainer(flameGraphData, { collapsing: true });
}

function setupDiffData() {
  const flameGraphData = createDataFrame({
    fields: [
      { name: 'level', values: [0, 1] },
      { name: 'value', values: [200, 90] },
      { name: 'valueRight', values: [100, 40] },
      { name: 'self', values: [110, 90] },
      { name: 'selfRight', values: [60, 40] },
      { name: 'label', values: ['total', 'func1'] },
    ],
  });
  return new FlameGraphDataContainer(flameGraphData, { collapsing: true });
}

describe('FlameGraphTooltip', () => {
  it('for bytes', () => {
    const tooltipData = getTooltipData(
      setupData('bytes'),
      { start: 0, itemIndexes: [0], value: 8_624_078_250, children: [], level: 0 },
      8_624_078_250
    );
    expect(tooltipData).toEqual({
      percentSelf: 0.01,
      percentValue: 100,
      unitTitle: 'RAM',
      unitSelf: '955 KiB',
      unitValue: '8.03 GiB',
      samples: '8,624,078,250',
    });
  });

  it('with default unit', () => {
    const tooltipData = getTooltipData(
      setupData('none'),
      { start: 0, itemIndexes: [0], value: 8_624_078_250, children: [], level: 0 },
      8_624_078_250
    );
    expect(tooltipData).toEqual({
      percentSelf: 0.01,
      percentValue: 100,
      unitSelf: '978250',
      unitTitle: 'Count',
      unitValue: '8624078250',
      samples: '8,624,078,250',
    });
  });

  it('without unit', () => {
    const tooltipData = getTooltipData(
      setupData('none'),
      { start: 0, itemIndexes: [0], value: 8_624_078_250, children: [], level: 0 },
      8_624_078_250
    );
    expect(tooltipData).toEqual({
      percentSelf: 0.01,
      percentValue: 100,
      unitTitle: 'Count',
      unitSelf: '978250',
      unitValue: '8624078250',
      samples: '8,624,078,250',
    });
  });

  it('for objects', () => {
    const tooltipData = getTooltipData(
      setupData('short'),
      { start: 0, itemIndexes: [0], value: 8_624_078_250, children: [], level: 0 },
      8_624_078_250
    );
    expect(tooltipData).toEqual({
      percentSelf: 0.01,
      percentValue: 100,
      unitTitle: 'Count',
      unitSelf: '978 K',
      unitValue: '8.62 Bil',
      samples: '8,624,078,250',
    });
  });

  it('for nanoseconds', () => {
    const tooltipData = getTooltipData(
      setupData('ns'),
      { start: 0, itemIndexes: [0], value: 8_624_078_250, children: [], level: 0 },
      8_624_078_250
    );
    expect(tooltipData).toEqual({
      percentSelf: 0.01,
      percentValue: 100,
      unitTitle: 'Time',
      unitSelf: '978 µs',
      unitValue: '8.62 s',
      samples: '8,624,078,250',
    });
  });
});

function setupDiffData2() {
  const flameGraphData = createDataFrame({
    fields: [
      { name: 'level', values: [0, 1] },
      { name: 'value', values: [101, 101] },
      { name: 'valueRight', values: [100, 100] },
      { name: 'self', values: [100, 100] },
      { name: 'selfRight', values: [1, 1] },
      { name: 'label', values: ['total', 'func1'] },
    ],
  });
  return new FlameGraphDataContainer(flameGraphData, { collapsing: true });
}

describe('getDiffTooltipData', () => {
  it('works with diff data', () => {
    const tooltipData = getDiffTooltipData(
      setupDiffData(),
      { start: 0, itemIndexes: [1], value: 90, valueRight: 40, children: [], level: 0 },
      200
    );
    expect(tooltipData).toEqual([
      {
        rowId: '1',
        label: '% of total',
        baseline: '50%',
        comparison: '40%',
        diff: '-20%',
      },
      {
        rowId: '2',
        label: 'Value',
        baseline: '50',
        comparison: '40',
        diff: '-10',
      },
      {
        rowId: '3',
        label: 'Samples',
        baseline: '50',
        comparison: '40',
        diff: '-10',
      },
    ]);
  });
  it('works with diff data and short values', () => {
    const tooltipData = getDiffTooltipData(
      setupDiffData2(),
      { start: 0, itemIndexes: [1], value: 101, valueRight: 100, children: [], level: 0 },
      200
    );
    expect(tooltipData).toEqual([
      {
        rowId: '1',
        label: '% of total',
        baseline: '1%',
        comparison: '100%',
        diff: '9.90 K%',
      },
      {
        rowId: '2',
        label: 'Value',
        baseline: '1',
        comparison: '100',
        diff: '99',
      },
      {
        rowId: '3',
        label: 'Samples',
        baseline: '1',
        comparison: '100',
        diff: '99',
      },
    ]);
  });
});

function makeField(name: string, unit: string, values: number[]): Field {
  return {
    name,
    type: FieldType.number,
    config: {
      unit,
    },
    values: values,
  };
}
