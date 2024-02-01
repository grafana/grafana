import { render } from '@testing-library/react';
import React from 'react';

import { DataFrame, FieldType, ValueLinkConfig, LinkTarget, Field, Vector } from '@grafana/data';
import { SortOrder, VisibilityMode } from '@grafana/schema';
import { LegendDisplayMode, TooltipDisplayMode } from '@grafana/ui';

import { XYChartTooltip, Props } from './XYChartTooltip';

describe('XYChartTooltip', () => {
  it('should render null when allSeries is empty', () => {
    const { container } = render(<XYChartTooltip {...getProps()} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render null when rowIndex is null', () => {
    const { container } = render(<XYChartTooltip {...getProps({ dataIdxs: [null] })} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render the tooltip content when allSeries and rowIndex are valid', () => {
    const { getByText } = render(
      <XYChartTooltip {...getProps({ allSeries: builtAllSeries, data: buildData(), dataIdxs: [1], seriesIdx: 1 })} />
    );
    expect(getByText('test')).toBeInTheDocument();
  });

  it('should render the tooltip header label with series name', () => {
    const { getByText } = render(
      <XYChartTooltip {...getProps({ allSeries: builtAllSeries, data: buildData(), dataIdxs: [1], seriesIdx: 1 })} />
    );
    expect(getByText('test')).toBeInTheDocument();
  });

  it('should render the tooltip content labels with x and y values', () => {
    const { getByText } = render(
      <XYChartTooltip {...getProps({ allSeries: builtAllSeries, data: buildData(), dataIdxs: [1], seriesIdx: 1 })} />
    );

    expect(getByText('field_1')).toBeInTheDocument();
    expect(getByText('32.799')).toBeInTheDocument();
  });

  it('should render the tooltip footer with data links', () => {
    const dataLinkTitle = 'Google';
    const { getByText } = render(
      <XYChartTooltip
        {...getProps({
          allSeries: builtAllSeries,
          data: buildData(dataLinkTitle),
          dataIdxs: [1],
          seriesIdx: 1,
          isPinned: true,
        })}
      />
    );

    expect(getByText(dataLinkTitle)).toBeInTheDocument();
  });
});

function getProps(additionalProps: Partial<Props> | null = null): Props {
  if (!additionalProps) {
    return defaultProps;
  }

  return { ...defaultProps, ...additionalProps };
}

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

const builtAllSeries = [
  {
    name: 'test',
    legend: jest.fn(),
    frame: (frames: DataFrame[]) => frames[0],
    x: (frame: DataFrame) => frame.fields[0],
    y: (frame: DataFrame) => frame.fields[1],
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
];

function buildData(dataLinkTitle = 'Grafana'): DataFrame[] {
  return [
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
        {
          name: 'field_2',
          type: FieldType.number,
          config: {},
          values: [500, 300, 150, 250, 600, 500, 700, 400, 540, 630, 460, 250, 500, 400, 800, 930, 360],
          getLinks: (_config: ValueLinkConfig) => [
            {
              href: 'http://www.someWebsite.com',
              title: dataLinkTitle,
              target: '_blank' as LinkTarget,
              origin: { name: '' } as Field<any, any[]>,
            },
          ],
        },
      ],
      length: 17,
    },
  ];
}
