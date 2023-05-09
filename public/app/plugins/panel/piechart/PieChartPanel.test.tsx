import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';

import {
  FieldConfigSource,
  toDataFrame,
  FieldType,
  VizOrientation,
  LoadingState,
  getDefaultTimeRange,
  EventBusSrv,
} from '@grafana/data';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { PieChartPanel } from './PieChartPanel';
import { Options, PieChartType, PieChartLegendValues } from './panelcfg.gen';

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: () => [() => {}, { width: 100, height: 100 }],
}));

type PieChartPanelProps = ComponentProps<typeof PieChartPanel>;

describe('PieChartPanel', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'ResizeObserver', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      })),
    });
  });

  describe('series overrides - Hide in area', () => {
    const defaultConfig = {
      custom: {
        hideFrom: {
          legend: false,
          viz: false,
          tooltip: false,
        },
      },
    };

    describe('when no hiding', () => {
      const seriesWithNoOverrides = [
        toDataFrame({
          fields: [
            { name: 'Chrome', config: defaultConfig, type: FieldType.number, values: [60] },
            { name: 'Firefox', config: defaultConfig, type: FieldType.number, values: [20] },
            { name: 'Safari', config: defaultConfig, type: FieldType.number, values: [20] },
          ],
        }),
      ];

      it('should not filter out any slices or legend items', () => {
        setup({ data: { series: seriesWithNoOverrides } });

        const slices = screen.queryAllByLabelText('Pie Chart Slice');
        expect(slices.length).toBe(3);
        expect(screen.queryByText(/Chrome/i)).toBeInTheDocument();
        expect(screen.queryByText(/Firefox/i)).toBeInTheDocument();
        expect(screen.queryByText(/Safari/i)).toBeInTheDocument();
      });
    });

    describe('when series override to hide viz', () => {
      const hideVizConfig = {
        custom: {
          hideFrom: {
            legend: false,
            viz: true,
            tooltip: false,
          },
        },
      };

      const seriesWithFirefoxOverride = [
        toDataFrame({
          fields: [
            { name: 'Chrome', config: defaultConfig, type: FieldType.number, values: [60] },
            { name: 'Firefox', config: hideVizConfig, type: FieldType.number, values: [20] },
            { name: 'Safari', config: defaultConfig, type: FieldType.number, values: [20] },
          ],
        }),
      ];

      it('should filter out the Firefox pie chart slice but not the legend', () => {
        setup({ data: { series: seriesWithFirefoxOverride } });

        const slices = screen.queryAllByLabelText('Pie Chart Slice');
        expect(slices.length).toBe(2);
        expect(screen.queryByText(/Firefox/i)).toBeInTheDocument();
      });
    });

    describe('when series override to hide tooltip', () => {
      const hideTooltipConfig = {
        custom: {
          hideFrom: {
            legend: false,
            viz: false,
            tooltip: true,
          },
        },
      };

      const seriesWithFirefoxOverride = [
        toDataFrame({
          fields: [
            { name: 'Chrome', config: defaultConfig, type: FieldType.number, values: [600] },
            { name: 'Firefox', config: hideTooltipConfig, type: FieldType.number, values: [190] },
            { name: 'Safari', config: defaultConfig, type: FieldType.number, values: [210] },
          ],
        }),
      ];

      it('should filter out the Firefox series with value 190 from the multi tooltip', async () => {
        setup({ data: { series: seriesWithFirefoxOverride } });

        await userEvent.hover(screen.getAllByLabelText('Pie Chart Slice')[0]);
        expect(screen.queryByText(/600/i)).toBeInTheDocument();
        expect(screen.queryByText(/190/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/210/i)).toBeInTheDocument();

        expect(screen.queryByText(/Firefox/i)).toBeInTheDocument();
        const slices = screen.queryAllByLabelText('Pie Chart Slice');
        expect(slices.length).toBe(3);
      });
    });

    describe('when series override to hide legend', () => {
      const hideLegendConfig = {
        custom: {
          hideFrom: {
            legend: true,
            viz: false,
            tooltip: false,
          },
        },
      };

      const seriesWithFirefoxOverride = [
        toDataFrame({
          fields: [
            { name: 'Chrome', config: defaultConfig, type: FieldType.number, values: [60] },
            { name: 'Firefox', config: hideLegendConfig, type: FieldType.number, values: [20] },
            { name: 'Safari', config: defaultConfig, type: FieldType.number, values: [20] },
          ],
        }),
      ];

      it('should filter out the series from the legend but not the slice', () => {
        setup({ data: { series: seriesWithFirefoxOverride } });

        expect(screen.queryByText(/Firefox/i)).not.toBeInTheDocument();
        const slices = screen.queryAllByLabelText('Pie Chart Slice');
        expect(slices.length).toBe(3);
      });
    });
  });
});

const setup = (propsOverrides?: {}) => {
  const fieldConfig: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  const options: Options = {
    pieType: PieChartType.Pie,
    displayLabels: [],
    legend: {
      displayMode: LegendDisplayMode.List,
      showLegend: true,
      placement: 'right',
      calcs: [],
      values: [PieChartLegendValues.Percent],
    },
    reduceOptions: {
      calcs: [],
    },
    orientation: VizOrientation.Auto,
    tooltip: { mode: TooltipDisplayMode.Multi, sort: SortOrder.Ascending },
  };

  const props: PieChartPanelProps = {
    id: 1,
    data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] },
    timeZone: 'utc',
    options: options,
    fieldConfig: fieldConfig,
    width: 532,
    height: 250,
    renderCounter: 0,
    title: 'A pie chart',
    transparent: false,
    onFieldConfigChange: () => {},
    onOptionsChange: () => {},
    onChangeTimeRange: () => {},
    replaceVariables: (s: string) => s,
    eventBus: new EventBusSrv(),
    timeRange: getDefaultTimeRange(),
    ...propsOverrides,
  };

  return render(<PieChartPanel {...props} />);
};
