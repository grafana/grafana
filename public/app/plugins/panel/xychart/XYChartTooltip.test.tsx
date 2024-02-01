import { render } from '@testing-library/react';
import React from 'react';

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
            pointSize: { fixed: 10, max: 10, min: 1},
            pointColor: {
              mode: {
                id: 'threshold',
                name: 'Threshold',
                getCalculator: jest.fn(),
              }
            }
          },
        },
      ],
      dataIdxs: [null],
    };

    const { container } = render(<XYChartTooltip {...props} />);
    expect(container.firstChild).toBeNull();
  });

  // it('should render the tooltip content when allSeries and rowIndex are valid', () => {
  //   const props = {
  //     ...defaultProps,
  //     allSeries: [
  //       {
  //         frame: jest.fn(),
  //         x: jest.fn(),
  //         y: jest.fn(),
  //         pointColor: jest.fn(),
  //         name: 'Series 1',
  //       },
  //     ],
  //     dataIdxs: [0],
  //   };

  //   const { getByText } = render(<XYChartTooltip {...props} />);
  //   expect(getByText('Series 1')).toBeInTheDocument();
  // });

  // Add more test cases as needed
});
