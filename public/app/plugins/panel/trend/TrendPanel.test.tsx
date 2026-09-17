import { render, screen } from '@testing-library/react';

import { createDataFrame, type DataFrame, FieldType, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { TrendPanel } from './TrendPanel';
import { type Options } from './panelcfg.gen';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  TooltipPlugin2: () => <div data-testid="trend-tooltip-plugin" />,
}));

const defaultOptions: Options = {
  legend: {
    showLegend: true,
    displayMode: LegendDisplayMode.List,
    placement: 'bottom',
    calcs: [],
  },
  tooltip: {
    mode: TooltipDisplayMode.Single,
    sort: SortOrder.None,
    maxWidth: 300,
    maxHeight: 300,
    hideZeros: false,
  },
};

const validFrame = createDataFrame({
  fields: [
    { name: 'x', type: FieldType.number, values: [1, 2, 3], config: { custom: {} } },
    { name: 'value', type: FieldType.number, values: [10, 20, 30], config: { custom: {} } },
  ],
});

function renderTrendPanel(options?: Partial<Options>, series: DataFrame[] = [validFrame]) {
  const props = getPanelProps<Options>(
    { ...defaultOptions, ...options },
    { data: { state: LoadingState.Done, series, timeRange: getDefaultTimeRange() } }
  );
  return render(<TrendPanel {...props} />);
}

describe('TrendPanel', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // uPlot logs benign warnings in jsdom; keep the test output clean.
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('renders the chart when data has a numeric x field (xField fallback)', () => {
    renderTrendPanel();

    expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeInTheDocument();
  });

  it('shows the error view when there are no numeric fields for the X axis', () => {
    const stringOnlyFrame = createDataFrame({
      fields: [{ name: 'label', type: FieldType.string, values: ['a', 'b', 'c'], config: { custom: {} } }],
    });

    renderTrendPanel(undefined, [stringOnlyFrame]);

    expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
    expect(screen.getByText(/Unable to render/i)).toBeInTheDocument();
  });

  it('shows the error view when the configured xField cannot be found', () => {
    renderTrendPanel({ xField: 'missing' });

    expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
  });

  it('renders TooltipPlugin2 when tooltip mode is not None', () => {
    // The legend is hidden so VizLayout renders the chart (and its plugin render-prop) synchronously in jsdom.
    renderTrendPanel({
      legend: { ...defaultOptions.legend, showLegend: false },
      tooltip: { ...defaultOptions.tooltip, mode: TooltipDisplayMode.Single },
    });

    expect(screen.getByTestId('trend-tooltip-plugin')).toBeInTheDocument();
  });

  it('does not render TooltipPlugin2 when tooltip mode is None', () => {
    renderTrendPanel({
      legend: { ...defaultOptions.legend, showLegend: false },
      tooltip: { ...defaultOptions.tooltip, mode: TooltipDisplayMode.None },
    });

    expect(screen.queryByTestId('trend-tooltip-plugin')).not.toBeInTheDocument();
  });
});
