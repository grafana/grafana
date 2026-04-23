import { render, screen } from '@testing-library/react';

import { createDataFrame, type DataFrame, DataFrameType, FieldType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { TimeSeriesPanel } from './TimeSeriesPanel';
import { type Options } from './panelcfg.gen';

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
    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000], config: {} },
    { name: 'value', type: FieldType.number, values: [10, 20, 30], config: { custom: {} } },
  ],
});

function renderPanel(options?: Partial<Options>, series: DataFrame[] = [validFrame]) {
  const props = getPanelProps<Options>({ ...defaultOptions, ...options });
  props.data.series = series;
  return render(<TimeSeriesPanel {...props} />);
}

describe('TimeSeriesPanel', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should render the chart and legend when data is valid', () => {
    renderPanel();

    expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeInTheDocument();
    expect(screen.getByTestId(selectors.components.VizLayout.legend)).toBeInTheDocument();
  });

  it('should show error view when series is empty', () => {
    renderPanel(undefined, []);

    expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
  });

  it('should show error view when frame has no time field', () => {
    const noTimeFrame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3], config: {} }],
    });

    renderPanel(undefined, [noTimeFrame]);

    expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
  });

  it('should show error view when all frames are TimeSeriesLong', () => {
    const longFrame = createDataFrame({
      meta: { type: DataFrameType.TimeSeriesLong },
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000], config: {} },
        { name: 'value', type: FieldType.number, values: [10, 20], config: {} },
      ],
    });

    renderPanel(undefined, [longFrame]);

    expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
  });

  it('should hide legend when showLegend is false', () => {
    renderPanel({ legend: { ...defaultOptions.legend, showLegend: false } });

    expect(screen.queryByTestId(selectors.components.VizLayout.legend)).not.toBeInTheDocument();
  });
});
