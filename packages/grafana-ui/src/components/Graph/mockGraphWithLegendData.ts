import { GraphWithLegendProps } from './GraphWithLegend';
import { LegendDisplayMode } from '../Legend/Legend';
import { DefaultTimeZone, dateTime } from '@grafana/data';
import { GraphProps } from './Graph';

export const mockGraphData = (): GraphProps => {
  return {
    series: [
      {
        label: 'A-series',
        color: '#7EB26D',
        isVisible: true,
        yAxis: {
          index: 1,
        },
        seriesIndex: 0,
        data: [
          [1571987796494, 1],
          [1571992116494, 20],
          [1571996436494, null],
          [1572000756494, 30],
          [1572005076494, 5],
          [1572009396494, 0],
        ],
      },
      {
        label: 'B-series',
        color: '#EAB839',
        isVisible: true,
        yAxis: {
          index: 1,
        },
        seriesIndex: 1,
        data: [
          [1571987796494, 2],
          [1571992116494, 40],
          [1571996436494, 120],
          [1572000756494, 230],
          [1572005076494, 50],
          [1572009396494, 0],
        ],
      },
    ],
    timeRange: {
      from: dateTime('2019-10-25T07:16:36.571Z'),
      to: dateTime('2019-10-25T13:16:36.572Z'),
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    },
    width: 944,
    height: 294,
    showBars: false,
    showLines: true,
    showPoints: false,
    timeZone: DefaultTimeZone,
    tooltipOptions: { mode: 'single' },
  };
};

export const mockGraphWithLegendData = ({
  displayMode,
  onSeriesColorChange,
  onSeriesAxisToggle,
}: Partial<GraphWithLegendProps>): GraphWithLegendProps => ({
  ...mockGraphData(),
  isLegendVisible: true,
  placement: 'under',
  onSeriesColorChange: (label, color) => {
    if (onSeriesColorChange) {
      onSeriesColorChange(label, color);
    }
  },
  onSeriesAxisToggle: (label, yAxis) => {
    if (onSeriesAxisToggle) {
      onSeriesAxisToggle(label, yAxis);
    }
  },
  onToggleSort: () => {},
  displayMode: displayMode || LegendDisplayMode.List,
  timeZone: DefaultTimeZone,
});
