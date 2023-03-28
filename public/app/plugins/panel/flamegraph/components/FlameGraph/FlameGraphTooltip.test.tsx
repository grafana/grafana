import { render } from '@testing-library/react';
import React from 'react';

import { ArrayVector, Field, FieldType, MutableDataFrame } from '@grafana/data';

import FlameGraphTooltip from './FlameGraphTooltip';
import { FlameGraphDataContainer } from './dataTransform';

describe('FlameGraphTooltip', () => {
  it('for bytes', () => {
    const flameGraphData = new MutableDataFrame({
      fields: [
        { name: 'level', values: [0] },
        { name: 'value', values: [0] },
      ],
    });
    const container = new FlameGraphDataContainer(flameGraphData);

    render(<FlameGraphTooltip data={container} totalTicks={8_624_078_250} item={{ start: 0, itemIndex: 0 }} />);

    const tooltipData = getTooltipData(makeField('bytes'), 'total', 8_624_078_250, 978_250, 8_624_078_250);
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
    const tooltipData = getTooltipData(makeField('none'), 'total', 8_624_078_250, 978_250, 8_624_078_250);
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
    const tooltipData = getTooltipData(
      {
        name: 'test',
        type: FieldType.number,
        values: new ArrayVector(),
        config: {},
      },
      'total',
      8_624_078_250,
      978_250,
      8_624_078_250
    );
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
    const tooltipData = getTooltipData(makeField('short'), 'total', 8_624_078_250, 978_250, 8_624_078_250);
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
    const tooltipData = getTooltipData(makeField('ns'), 'total', 8_624_078_250, 978_250, 8_624_078_250);
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

function makeField(unit: string): Field {
  return {
    name: 'test',
    type: FieldType.number,
    config: {
      unit,
    },
    values: new ArrayVector(),
  };
}
