import { Field, FieldType, MutableDataFrame } from '@grafana/data';

import { getTooltipData } from './FlameGraphTooltip';
import { FlameGraphDataContainer } from './dataTransform';

function setupData(unit?: string) {
  const flameGraphData = new MutableDataFrame({
    fields: [
      { name: 'level', values: [0] },
      unit ? makeField('value', unit, [8_624_078_250]) : { name: 'value', values: [8_624_078_250] },
      { name: 'self', values: [978_250] },
      { name: 'label', values: ['total'] },
    ],
  });
  return new FlameGraphDataContainer(flameGraphData);
}

describe('FlameGraphTooltip', () => {
  it('for bytes', () => {
    const tooltipData = getTooltipData(setupData('bytes'), { start: 0, itemIndex: 0 }, 8_624_078_250);
    expect(tooltipData).toEqual({
      name: 'total',
      percentSelf: 0.01,
      percentValue: 100,
      unitTitle: 'RAM',
      unitSelf: '955 KiB',
      unitValue: '8.03 GiB',
      samples: '8,624,078,250',
    });
  });

  it('with default unit', () => {
    const tooltipData = getTooltipData(setupData('none'), { start: 0, itemIndex: 0 }, 8_624_078_250);
    expect(tooltipData).toEqual({
      name: 'total',
      percentSelf: 0.01,
      percentValue: 100,
      unitSelf: '978250',
      unitTitle: 'Count',
      unitValue: '8624078250',
      samples: '8,624,078,250',
    });
  });

  it('without unit', () => {
    const tooltipData = getTooltipData(setupData('none'), { start: 0, itemIndex: 0 }, 8_624_078_250);
    expect(tooltipData).toEqual({
      name: 'total',
      percentSelf: 0.01,
      percentValue: 100,
      unitTitle: 'Count',
      unitSelf: '978250',
      unitValue: '8624078250',
      samples: '8,624,078,250',
    });
  });

  it('for objects', () => {
    const tooltipData = getTooltipData(setupData('short'), { start: 0, itemIndex: 0 }, 8_624_078_250);
    expect(tooltipData).toEqual({
      name: 'total',
      percentSelf: 0.01,
      percentValue: 100,
      unitTitle: 'Count',
      unitSelf: '978 K',
      unitValue: '8.62 Bil',
      samples: '8,624,078,250',
    });
  });

  it('for nanoseconds', () => {
    const tooltipData = getTooltipData(setupData('ns'), { start: 0, itemIndex: 0 }, 8_624_078_250);
    expect(tooltipData).toEqual({
      name: 'total',
      percentSelf: 0.01,
      percentValue: 100,
      unitTitle: 'Time',
      unitSelf: '978 µs',
      unitValue: '8.62 s',
      samples: '8,624,078,250',
    });
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
