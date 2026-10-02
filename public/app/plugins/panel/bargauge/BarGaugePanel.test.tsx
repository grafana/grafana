import { render, screen, within } from '@testing-library/react';
import { uniqueId } from 'lodash';

import {
  dateMath,
  dateTime,
  type EventBus,
  type FieldDisplay,
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
  BigValueTextMode,
  LegendDisplayMode,
  type LegendPlacement,
} from '@grafana/schema';

import {
  BarGaugePanel,
  calcBarSize,
  getBarGaugeAlignmentFactors,
  getItemSpacing,
  getLegend,
  getOrientation,
  type BarGaugePanelProps,
} from './BarGaugePanel';
import { defaultOptions, type Options } from './panelcfg.gen';

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

      expect(getLegend(panelData.options, panelData.data)).toBeNull();
    });

    it('does not render a legend when there is no data', () => {
      const panelData = buildPanelData();
      panelData.options.legend.showLegend = true;

      expect(getLegend(panelData.options, panelData.data)).toBeNull();
    });
  });

  describe('getItemSpacing', () => {
    it('uses tighter spacing for the LCD display mode than for non-LCD display modes', () => {
      expect(getItemSpacing(BarGaugeDisplayMode.Gradient)).toBeGreaterThan(getItemSpacing(BarGaugeDisplayMode.Lcd));
    });
  });

  describe('getOrientation', () => {
    it('returns the explicit orientation when not Auto', () => {
      expect(getOrientation(VizOrientation.Vertical, 552, 250)).toBe(VizOrientation.Vertical);
    });

    it('resolves Auto to Vertical when wider than tall', () => {
      expect(getOrientation(VizOrientation.Auto, 600, 200)).toBe(VizOrientation.Vertical);
    });

    it('resolves Auto to Horizontal when taller than wide', () => {
      expect(getOrientation(VizOrientation.Auto, 200, 600)).toBe(VizOrientation.Horizontal);
    });
  });

  describe('calcBarSize', () => {
    it('uses default sizes when sizing is Auto', () => {
      const panelData = buildPanelData();
      panelData.options.sizing = BarGaugeSizing.Auto;
      panelData.options.minVizWidth = 111;
      panelData.options.minVizHeight = 222;
      panelData.options.maxVizHeight = 333;

      expect(calcBarSize(panelData.options, VizOrientation.Horizontal)).toEqual({
        minVizWidth: defaultOptions.minVizWidth,
        minVizHeight: defaultOptions.minVizHeight,
        maxVizHeight: defaultOptions.maxVizHeight,
      });
    });

    it('applies manual min width for vertical orientation', () => {
      const panelData = buildPanelData();
      panelData.options.sizing = BarGaugeSizing.Manual;
      panelData.options.minVizWidth = 42;

      expect(calcBarSize(panelData.options, VizOrientation.Vertical).minVizWidth).toBe(42);
    });

    it('applies manual min/max height for horizontal orientation', () => {
      const panelData = buildPanelData();
      panelData.options.sizing = BarGaugeSizing.Manual;
      panelData.options.minVizHeight = 20;
      panelData.options.maxVizHeight = 250;

      const result = calcBarSize(panelData.options, VizOrientation.Horizontal);
      expect(result.minVizHeight).toBe(20);
      expect(result.maxVizHeight).toBe(250);
    });
  });

  describe('single series', () => {
    function dataWithOneSeries() {
      return {
        series: [toDataFrame({ target: 'onlySeries', datapoints: [[100, 1000]] })],
        timeRange: createTimeRange(),
        state: LoadingState.Done,
      };
    }

    it('hides the series name when there is a single unnamed series', () => {
      const panelData = buildPanelData({ data: dataWithOneSeries() });

      render(<BarGaugePanel {...panelData} />);

      expect(screen.queryByText(/onlyseries/i)).not.toBeInTheDocument();
      expect(screen.getByTestId(valueSelector)).toBeInTheDocument();
    });

    it.each([
      [BigValueTextMode.Name, VizOrientation.Horizontal],
      [BigValueTextMode.Name, VizOrientation.Vertical],
      [BigValueTextMode.ValueAndName, VizOrientation.Horizontal],
      [BigValueTextMode.ValueAndName, VizOrientation.Vertical],
    ])('shows the series name for a single unnamed series when textMode is %s (%s)', (textMode, orientation) => {
      const panelData = buildPanelData({ data: dataWithOneSeries() });
      panelData.options.textMode = textMode;
      panelData.options.orientation = orientation;

      render(<BarGaugePanel {...panelData} />);

      expect(screen.getByText(/onlyseries/i)).toBeInTheDocument();
    });

    it('hides the series name but keeps the value for a single unnamed series when textMode is Value', () => {
      const panelData = buildPanelData({ data: dataWithOneSeries() });
      panelData.options.textMode = BigValueTextMode.Value;

      render(<BarGaugePanel {...panelData} />);

      expect(screen.queryByText(/onlyseries/i)).not.toBeInTheDocument();
      expect(screen.getByTestId(valueSelector)).toBeInTheDocument();
    });

    it('still hides the series name when textMode is Name but namePlacement is Hidden', () => {
      const panelData = buildPanelData({ data: dataWithOneSeries() });
      panelData.options.textMode = BigValueTextMode.Name;
      panelData.options.namePlacement = BarGaugeNamePlacement.Hidden;

      render(<BarGaugePanel {...panelData} />);

      // The name stays in the DOM, hidden by the styles getTitleStyles applies.
      expect(screen.getByText(/onlyseries/i)).not.toBeVisible();
      expect(screen.queryByTestId(valueSelector)).not.toBeInTheDocument();
    });
  });

  describe('value visibility', () => {
    function dataWithNamedSeries() {
      return {
        series: [
          toDataFrame({ target: 'ServerA', datapoints: [[100, 1000]] }),
          toDataFrame({ target: 'ServerB', datapoints: [[200, 1000]] }),
        ],
        timeRange: createTimeRange(),
        state: LoadingState.Done,
      };
    }

    it.each([BigValueTextMode.Auto, BigValueTextMode.Value, BigValueTextMode.ValueAndName])(
      'shows the value when textMode is %s',
      (textMode) => {
        const panelData = buildPanelData({ data: dataWithNamedSeries() });
        panelData.options.textMode = textMode;

        render(<BarGaugePanel {...panelData} />);

        expect(screen.getAllByTestId(valueSelector)).toHaveLength(2);
      }
    );

    it.each([BigValueTextMode.Name, BigValueTextMode.None])(
      'hides the value when textMode is %s, regardless of the "Value display" setting',
      (textMode) => {
        const panelData = buildPanelData({ data: dataWithNamedSeries() });
        panelData.options.textMode = textMode;
        panelData.options.valueMode = BarGaugeValueMode.Color;

        render(<BarGaugePanel {...panelData} />);

        expect(screen.queryByTestId(valueSelector)).not.toBeInTheDocument();
      }
    );

    it('hides both the value and the series name when textMode is None', () => {
      const panelData = buildPanelData({ data: dataWithNamedSeries() });
      panelData.options.textMode = BigValueTextMode.None;

      render(<BarGaugePanel {...panelData} />);

      expect(screen.queryByText(/servera/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/serverb/i)).not.toBeInTheDocument();
      expect(screen.queryByTestId(valueSelector)).not.toBeInTheDocument();
    });

    it('shows the series name but hides the value when textMode is Name', () => {
      const panelData = buildPanelData({ data: dataWithNamedSeries() });
      panelData.options.textMode = BigValueTextMode.Name;

      render(<BarGaugePanel {...panelData} />);

      expect(screen.getByText(/servera/i)).toBeInTheDocument();
      expect(screen.getByText(/serverb/i)).toBeInTheDocument();
      expect(screen.queryByTestId(valueSelector)).not.toBeInTheDocument();
    });
  });

  describe('getBarGaugeAlignmentFactors', () => {
    function buildFieldDisplay(title: string): FieldDisplay {
      return {
        name: title,
        field: {},
        display: { numeric: 0, text: String(42), title },
        hasLinks: false,
      };
    }

    // BarGauge reserves name-column/row space purely based on alignmentFactors.title being
    // non-empty, so it must reflect per-bar suppression or hidden names still take up space.
    it.each([BigValueTextMode.Value, BigValueTextMode.None])(
      'clears the shared title for multiple bars when textMode is %s',
      (textMode) => {
        const values = [buildFieldDisplay('ServerA'), buildFieldDisplay('ServerB'), buildFieldDisplay('ServerC')];
        const options = { ...defaultOptions, textMode } as Options;

        expect(getBarGaugeAlignmentFactors(values, options).title).toBeFalsy();
      }
    );

    it.each([BigValueTextMode.Auto, BigValueTextMode.Name, BigValueTextMode.ValueAndName])(
      'keeps the longest shared title for multiple bars when textMode is %s',
      (textMode) => {
        const values = [buildFieldDisplay('ServerA'), buildFieldDisplay('ServerB'), buildFieldDisplay('ServerC')];
        const options = { ...defaultOptions, textMode } as Options;

        expect(getBarGaugeAlignmentFactors(values, options).title).toBe('ServerA');
      }
    );
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
      textMode: BigValueTextMode.Auto,
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
