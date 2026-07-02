import { render } from '@testing-library/react';

import { createTheme, dateTime, type FieldSparkline, FieldType } from '@grafana/data';

import { UPlotChart } from '../uPlot/Plot';

import { Sparkline } from './Sparkline';

jest.mock('../uPlot/Plot', () => ({
  UPlotChart: jest.fn(() => null),
}));

const UPlotChartMock = jest.mocked(UPlotChart);

describe('Sparkline', () => {
  beforeEach(() => {
    UPlotChartMock.mockClear();
  });

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

  it('should reuse derived plot props when only dimensions change', () => {
    const theme = createTheme();
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

    const { rerender } = render(<Sparkline width={800} height={600} theme={theme} sparkline={sparkline} />);
    expect(UPlotChartMock).toHaveBeenCalled();
    const firstProps = UPlotChartMock.mock.calls[0][0];

    UPlotChartMock.mockClear();
    rerender(<Sparkline width={400} height={300} theme={theme} sparkline={sparkline} />);
    expect(UPlotChartMock).toHaveBeenCalled();
    const secondProps = UPlotChartMock.mock.calls[0][0];

    expect(secondProps.data).toBe(firstProps.data);
    expect(secondProps.config).toBe(firstProps.config);
  });

  it('should reuse plot config when only time range changes', () => {
    const theme = createTheme();
    const sparkline: FieldSparkline = {
      x: {
        name: 'x',
        values: [1679839200000, 1680444000000, 1681048800000, 1681653600000, 1682258400000],
        type: FieldType.time,
        config: {
          interval: 604800000,
        },
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
      timeRange: {
        from: dateTime(1679839200000),
        to: dateTime(1682258400000),
        raw: { from: dateTime(1679839200000), to: dateTime(1682258400000) },
      },
    };

    const { rerender } = render(<Sparkline width={800} height={600} theme={theme} sparkline={sparkline} />);
    expect(UPlotChartMock).toHaveBeenCalled();
    const firstProps = UPlotChartMock.mock.calls[0][0];

    UPlotChartMock.mockClear();
    rerender(
      <Sparkline
        width={800}
        height={600}
        theme={theme}
        sparkline={{
          ...sparkline,
          timeRange: {
            from: dateTime(1679234400000),
            to: dateTime(1682863200000),
            raw: { from: dateTime(1679234400000), to: dateTime(1682863200000) },
          },
        }}
      />
    );
    expect(UPlotChartMock).toHaveBeenCalled();
    const secondProps = UPlotChartMock.mock.calls[0][0];

    expect(secondProps.config).toBe(firstProps.config);
  });
});
