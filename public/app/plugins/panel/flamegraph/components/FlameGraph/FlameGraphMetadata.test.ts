import { createDataFrame } from '@grafana/data';

import { getMetadata } from './FlameGraphMetadata';
import { FlameGraphDataContainer } from './dataTransform';

function makeDataFrame(fields: Record<string, Array<number | string>>, unit?: string) {
  return createDataFrame({
    fields: Object.keys(fields).map((key) => ({
      name: key,
      values: fields[key],
      config: unit
        ? {
            unit,
          }
        : {},
    })),
  });
}

describe('should get metadata correctly', () => {
  it('for bytes', () => {
    const container = new FlameGraphDataContainer(
      makeDataFrame({ value: [1_624_078_250], level: [1], label: ['1'], self: [0] }, 'bytes')
    );
    const metadata = getMetadata(container, 0, 8_624_078_250);
    expect(metadata).toEqual({
      percentValue: 18.83,
      unitTitle: 'RAM',
      unitValue: '1.51 GiB',
      samples: '8,624,078,250',
    });
  });

  it('with default unit', () => {
    const container = new FlameGraphDataContainer(
      makeDataFrame({ value: [1_624_078_250], level: [1], label: ['1'], self: [0] }, 'none')
    );
    const metadata = getMetadata(container, 0, 8_624_078_250);
    expect(metadata).toEqual({
      percentValue: 18.83,
      unitTitle: 'Count',
      unitValue: '1624078250',
      samples: '8,624,078,250',
    });
  });

  it('without unit', () => {
    const container = new FlameGraphDataContainer(
      makeDataFrame({ value: [1_624_078_250], level: [1], label: ['1'], self: [0] })
    );
    const metadata = getMetadata(container, 0, 8_624_078_250);
    expect(metadata).toEqual({
      percentValue: 18.83,
      unitTitle: 'Count',
      unitValue: '1624078250',
      samples: '8,624,078,250',
    });
  });

  it('for objects', () => {
    const container = new FlameGraphDataContainer(
      makeDataFrame({ value: [1_624_078_250], level: [1], label: ['1'], self: [0] }, 'short')
    );
    const metadata = getMetadata(container, 0, 8_624_078_250);
    expect(metadata).toEqual({
      percentValue: 18.83,
      unitTitle: 'Count',
      unitValue: '1.62 Bil',
      samples: '8,624,078,250',
    });
  });

  it('for nanoseconds', () => {
    const container = new FlameGraphDataContainer(
      makeDataFrame({ value: [1_624_078_250], level: [1], label: ['1'], self: [0] }, 'ns')
    );
    const metadata = getMetadata(container, 0, 8_624_078_250);
    expect(metadata).toEqual({
      percentValue: 18.83,
      unitTitle: 'Time',
      unitValue: '1.62 s',
      samples: '8,624,078,250',
    });
  });
});
