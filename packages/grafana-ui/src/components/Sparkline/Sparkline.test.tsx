import { render } from '@testing-library/react';

import { createTheme, FieldSparkline, FieldType } from '@grafana/data';

import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('should render without throwing an error', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [1, 2, 3, 4, 5],
        type: FieldType.number,
        config: {},
        state: {
          range: { min: 1, max: 5, delta: 1 },
        },
      },
    };
    expect(() =>
      render(<Sparkline width={800} height={600} theme={createTheme()} sparkline={sparkline} />)
    ).not.toThrow();
  });

  it('should not throw an error if there is a single value', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1679839200000],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [1],
        type: FieldType.number,
        config: {},
        state: {
          range: { min: 1, max: 1, delta: 0 },
        },
      },
    };
    expect(() =>
      render(<Sparkline width={800} height={600} theme={createTheme()} sparkline={sparkline} />)
    ).not.toThrow();
  });

  it('should not throw an error if there are no values', () => {
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [],
        type: FieldType.time,
        config: {},
      },
      y: {
        name: 'y',
        values: [],
        type: FieldType.number,
        config: {},
        state: {},
      },
    };
    expect(() =>
      render(<Sparkline width={800} height={600} theme={createTheme()} sparkline={sparkline} />)
    ).not.toThrow();
  });
});
