import { render, screen, within } from '@testing-library/react';
import { uniqueId } from 'lodash';

import {
  dateMath,
  dateTime,
  type EventBus,
  LoadingState,
  type TimeRange,
  toDataFrame,
  VizOrientation,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  BarGaugeDisplayMode,
  BarGaugeValueMode,
  BarGaugeNamePlacement,
  BarGaugeSizing,
  LegendDisplayMode,
  type LegendPlacement,
} from '@grafana/schema';

import { BarGaugePanel, type BarGaugePanelProps } from './BarGaugePanel';
import { defaultOptions } from './panelcfg.gen';

const valueSelector = selectors.components.Panels.Visualization.BarGauge.valueV2;

describe('BarGaugePanel', () => {
  describe('when there is no data', () => {
    it('show a "No Data" message', () => {
      const panelData = buildPanelData();

      render(<BarGaugePanel {...panelData} />);

      expect(screen.getByText(/no data/i)).toBeInTheDocument();
    });
  });

  describe('when there is data', () => {
    it('shows the panel', () => {
      const firstBarPanel = 'firstBarPanel';
      const secondBarPanel = 'secondBarPanel';
      const panelData = buildPanelData({
        data: {
          series: [
            toDataFrame({
              target: firstBarPanel,
              datapoints: [
                [100, 1000],
                [100, 200],
              ],
            }),
          ],
          timeRange: createTimeRange(),
          state: LoadingState.Done,
        },
      });

      const { rerender } = render(<BarGaugePanel {...panelData} />);
      expect(screen.queryByText(/100/)).toBeInTheDocument();
      expect(screen.queryByText(/firstbarpanel/i)).not.toBeInTheDocument();
      expect(screen.getByTestId(valueSelector)).toBeInTheDocument();

      rerender(
        <BarGaugePanel
          {...buildPanelData({
            data: {
              series: [
                toDataFrame({
                  target: firstBarPanel,
                  datapoints: [
                    [200, 1000],
                    [200, 300],
                  ],
                }),
                toDataFrame({
                  target: secondBarPanel,
                  datapoints: [
                    [300, 3000],
                    [300, 300],
                  ],
                }),
              ],
              timeRange: createTimeRange(),
              state: LoadingState.Done,
            },
          })}
        />
      );

      expect(screen.queryByText(/firstbarpanel/i)).toBeInTheDocument();
      expect(screen.queryByText(/secondbarpanel/i)).toBeInTheDocument();
      expect(screen.queryByText(/200/)).toBeInTheDocument();
      expect(screen.queryByText(/300/)).toBeInTheDocument();
      expect(screen.getAllByTestId(valueSelector).length).toEqual(2);
    });
  });

  describe('legend', () => {
    function dataWithTwoSeries() {
      return {
        series: [
          toDataFrame({ target: 'series-a', datapoints: [[100, 1000]] }),
          toDataFrame({ target: 'series-b', datapoints: [[200, 1000]] }),
        ],
        timeRange: createTimeRange(),
        state: LoadingState.Done,
      };
    }

    it('renders the legend when showLegend is enabled and there is data', () => {
      const panelData = buildPanelData({ data: dataWithTwoSeries() });
      panelData.options.legend.showLegend = true;

      render(<BarGaugePanel {...panelData} />);

      // Series names also render as bar titles, so scope the assertions to the
      // legend container to prove the legend itself is present.
      const legend = within(screen.getByTestId(selectors.components.VizLayout.legend));
      expect(legend.getByText(/series-a/i)).toBeInTheDocument();
      expect(legend.getByText(/series-b/i)).toBeInTheDocument();
    });

    it('does not render a legend when showLegend is disabled', () => {
      const panelData = buildPanelData({ data: dataWithTwoSeries() });
      panelData.options.legend.showLegend = false;

      const panel = new BarGaugePanel(panelData);
      expect(panel.getLegend()).toBeNull();
    });

    it('does not render a legend when there is no data', () => {
      const panelData = buildPanelData();
      panelData.options.legend.showLegend = true;

      const panel = new BarGaugePanel(panelData);
      expect(panel.getLegend()).toBeNull();
    });
  });

  describe('getItemSpacing', () => {
    it('uses tighter spacing for the LCD display mode than for non-LCD display modes', () => {
      const lcd = buildPanelData();
      lcd.options.displayMode = BarGaugeDisplayMode.Lcd;

      const nonLcd = buildPanelData();
      nonLcd.options.displayMode = BarGaugeDisplayMode.Gradient;

      expect(new BarGaugePanel(nonLcd).getItemSpacing()).toBeGreaterThan(new BarGaugePanel(lcd).getItemSpacing());
    });
  });

  describe('getOrientation', () => {
    it('returns the explicit orientation when not Auto', () => {
      const panelData = buildPanelData();
      panelData.options.orientation = VizOrientation.Vertical;
      expect(new BarGaugePanel(panelData).getOrientation()).toBe(VizOrientation.Vertical);
    });

    it('resolves Auto to Vertical when wider than tall', () => {
      const panelData = buildPanelData({ width: 600, height: 200 });
      panelData.options.orientation = VizOrientation.Auto;
      expect(new BarGaugePanel(panelData).getOrientation()).toBe(VizOrientation.Vertical);
    });

    it('resolves Auto to Horizontal when taller than wide', () => {
      const panelData = buildPanelData({ width: 200, height: 600 });
      panelData.options.orientation = VizOrientation.Auto;
      expect(new BarGaugePanel(panelData).getOrientation()).toBe(VizOrientation.Horizontal);
    });
  });

  describe('calcBarSize', () => {
    it('uses default sizes when sizing is Auto', () => {
      const panelData = buildPanelData();
      panelData.options.sizing = BarGaugeSizing.Auto;
      panelData.options.minVizWidth = 111;
      panelData.options.minVizHeight = 222;
      panelData.options.maxVizHeight = 333;

      expect(new BarGaugePanel(panelData).calcBarSize()).toEqual({
        minVizWidth: defaultOptions.minVizWidth,
        minVizHeight: defaultOptions.minVizHeight,
        maxVizHeight: defaultOptions.maxVizHeight,
      });
    });

    it('applies manual min width for vertical orientation', () => {
      const panelData = buildPanelData();
      panelData.options.sizing = BarGaugeSizing.Manual;
      panelData.options.orientation = VizOrientation.Vertical;
      panelData.options.minVizWidth = 42;

      expect(new BarGaugePanel(panelData).calcBarSize().minVizWidth).toBe(42);
    });

    it('applies manual min/max height for horizontal orientation', () => {
      const panelData = buildPanelData();
      panelData.options.sizing = BarGaugeSizing.Manual;
      panelData.options.orientation = VizOrientation.Horizontal;
      panelData.options.minVizHeight = 20;
      panelData.options.maxVizHeight = 250;

      const result = new BarGaugePanel(panelData).calcBarSize();
      expect(result.minVizHeight).toBe(20);
      expect(result.maxVizHeight).toBe(250);
    });
  });

  describe('single series', () => {
    it('hides the series name when there is a single unnamed series', () => {
      const panelData = buildPanelData({
        data: {
          series: [toDataFrame({ target: 'onlySeries', datapoints: [[100, 1000]] })],
          timeRange: createTimeRange(),
          state: LoadingState.Done,
        },
      });

      render(<BarGaugePanel {...panelData} />);

      expect(screen.queryByText(/onlyseries/i)).not.toBeInTheDocument();
      expect(screen.getByTestId(valueSelector)).toBeInTheDocument();
    });
  });
});

function buildPanelData(overrideValues?: Partial<BarGaugePanelProps>): BarGaugePanelProps {
  const timeRange = createTimeRange();
  const defaultValues = {
    id: Number(uniqueId()),
    data: {
      series: [],
      state: LoadingState.Done,
      timeRange,
    },
    options: {
      displayMode: BarGaugeDisplayMode.Lcd,
      reduceOptions: {
        calcs: ['mean'],
        values: false,
      },
      orientation: VizOrientation.Horizontal,
      showUnfilled: true,
      maxVizHeight: 100,
      minVizHeight: 10,
      minVizWidth: 0,
      valueMode: BarGaugeValueMode.Color,
      namePlacement: BarGaugeNamePlacement.Auto,
      sizing: BarGaugeSizing.Auto,
      legend: {
        showLegend: false,
        placement: 'bottom' as LegendPlacement,
        calcs: [],
        displayMode: LegendDisplayMode.List,
      },
    },
    transparent: false,
    timeRange,
    timeZone: 'utc',
    title: 'hello',
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
    onFieldConfigChange: jest.fn(),
    onOptionsChange: jest.fn(),
    onChangeTimeRange: jest.fn(),
    replaceVariables: jest.fn(),
    renderCounter: 0,
    width: 552,
    height: 250,
    eventBus: {} as EventBus,
  };

  return {
    ...defaultValues,
    ...overrideValues,
  };
}
function createTimeRange(): TimeRange {
  return {
    from: dateMath.parse('now-6h') || dateTime(),
    to: dateMath.parse('now') || dateTime(),
    raw: { from: 'now-6h', to: 'now' },
  };
}
