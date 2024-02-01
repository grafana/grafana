import { render } from '@testing-library/react';
import React from 'react';

import { DataFrame, FieldType } from '@grafana/data';
import { SortOrder, VisibilityMode } from '@grafana/schema';
import { LegendDisplayMode, TooltipDisplayMode } from '@grafana/ui';

import { XYChartTooltip, Props } from './XYChartTooltip';
// import { ScatterSeries } from './types';

describe('XYChartTooltip', () => {
  const defaultProps: Props = {
    data: [],
    allSeries: [],
    dataIdxs: [],
    seriesIdx: null,
    isPinned: false,
    dismiss: jest.fn(),
    options: {
      dims: {
        frame: 0,
      },
      series: [],
      legend: {
        calcs: [],
        displayMode: LegendDisplayMode.List,
        placement: 'bottom',
        showLegend: true,
      },
      tooltip: {
        mode: TooltipDisplayMode.Single,
        sort: SortOrder.Ascending,
      },
    },
  };

  it('should render null when allSeries is empty', () => {
    const props = {
      ...defaultProps,
      allSeries: [],
    };

    const { container } = render(<XYChartTooltip {...props} />);
    console.log(container, 'container');
    expect(container.firstChild).toBeNull();
  });

  it('should render null when rowIndex is null', () => {
    const props = {
      ...defaultProps,
      allSeries: [
        {
          name: 'test',
          legend: jest.fn(),
          frame: jest.fn(),
          x: jest.fn(),
          y: jest.fn(),
          pointColor: jest.fn(),
          showLine: false,
          lineWidth: 1,
          lineStyle: {},
          lineColor: jest.fn(),
          showPoints: VisibilityMode.Always,
          pointSize: jest.fn(),
          pointSymbol: jest.fn(),
          label: VisibilityMode.Always,
          labelValue: jest.fn(),
          show: true,
          hints: {
            pointSize: { fixed: 10, max: 10, min: 1 },
            pointColor: {
              mode: {
                id: 'threshold',
                name: 'Threshold',
                getCalculator: jest.fn(),
              },
            },
          },
        },
      ],
      dataIdxs: [null],
    };

    const { container } = render(<XYChartTooltip {...props} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render the tooltip content when allSeries and rowIndex are valid', () => {
    const props = {
      ...defaultProps,
      allSeries: [
        {
          name: 'test',
          legend: jest.fn(),
          frame: (frames: DataFrame[]) => frames[0],
          x: (frame: DataFrame) => frame.fields[0],
          y: (frame: DataFrame) => frame.fields[0],
          pointColor: (_frame: DataFrame) => '#111',
          showLine: false,
          lineWidth: 1,
          lineStyle: {},
          lineColor: jest.fn(),
          showPoints: VisibilityMode.Always,
          pointSize: jest.fn(),
          pointSymbol: jest.fn(),
          label: VisibilityMode.Always,
          labelValue: jest.fn(),
          show: true,
          hints: {
            pointSize: { fixed: 10, max: 10, min: 1 },
            pointColor: {
              mode: {
                id: 'threshold',
                name: 'Threshold',
                getCalculator: jest.fn(),
              },
            },
          },
        },
      ],
      dataIdxs: [1],
      data: [
        {
          fields: [
            {
              name: 'field_1',
              type: FieldType.number,
              config: {},
              values: [
                61.385, 32.799, 33.7712, 36.17, 39.0646, 27.8333, 42.0046, 40.3363, 39.8647, 37.669, 42.2373, 43.3504,
                35.6411, 40.314, 34.8375, 40.3736, 44.5672,
              ],
            },
          ],
          length: 1,
        },
      ],
      seriesIdx: 1,
    };

    const { getByText } = render(<XYChartTooltip {...props} />);
    expect(getByText('test')).toBeInTheDocument();
  });

  // Add more test cases as needed
});
