import { ArrayVector, Field, FieldType } from '@grafana/data';

import { getMetadata } from './FlameGraphMetadata';

describe('should get metadata correctly', () => {
  it('for bytes', () => {
    const metadata = getMetadata(makeField('bytes'), 1_624_078_250, 8_624_078_250);
    expect(metadata).toEqual({
      percentValue: 18.83,
      unitTitle: 'RAM',
      unitValue: '1.51 GiB',
      samples: '8,624,078,250',
    });
  });

  it('with default unit', () => {
    const metadata = getMetadata(makeField('none'), 1_624_078_250, 8_624_078_250);
    expect(metadata).toEqual({
      percentValue: 18.83,
      unitTitle: 'Count',
      unitValue: '1624078250',
      samples: '8,624,078,250',
    });
  });

  it('without unit', () => {
    const metadata = getMetadata(
      {
        name: 'test',
        type: FieldType.number,
        values: new ArrayVector(),
        config: {},
      },
      1_624_078_250,
      8_624_078_250
    );
    expect(metadata).toEqual({
      percentValue: 18.83,
      unitTitle: 'Count',
      unitValue: '1624078250',
      samples: '8,624,078,250',
    });
  });

  it('for objects', () => {
    const metadata = getMetadata(makeField('short'), 1_624_078_250, 8_624_078_250);
    expect(metadata).toEqual({
      percentValue: 18.83,
      unitTitle: 'Count',
      unitValue: '1.62 Bil',
      samples: '8,624,078,250',
    });
  });

  it('for nanoseconds', () => {
    const metadata = getMetadata(makeField('ns'), 1_624_078_250, 8_624_078_250);
    expect(metadata).toEqual({
      percentValue: 18.83,
      unitTitle: 'Time',
      unitValue: '1.62 s',
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
