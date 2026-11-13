import { act, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

import {
  applyFieldOverrides,
  createDataFrame,
  createTheme,
  type DataFrame,
  FieldType,
  getDefaultTimeRange,
  LoadingState,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { StatusHistoryPanel } from './StatusHistoryPanel';
import { plugin } from './module';
import { defaultFieldConfig, defaultOptions, type Options } from './panelcfg.gen';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  // Invoke the panel's render-prop (as the real plugin does on hover) so the tooltip body is exercised.
  TooltipPlugin2: (props: { render?: (...args: unknown[]) => ReactNode }) => {
    const u = { posToVal: () => 0, cursor: { left: 0 } };
    const content = props.render?.(u, [0, 0], 1, false, jest.fn(), null, false, []);
    return <div data-testid="status-history-tooltip-plugin">{content}</div>;
  },
}));

const baseOptions: Options = {
  ...defaultOptions,
  legend: { showLegend: true, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
  tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None, maxWidth: 300, maxHeight: 300, hideZeros: false },
} as Options;

const fieldConfig = { defaults: { custom: defaultFieldConfig }, overrides: [] };

// The panel pipeline supplies custom field defaults as well as legend/tooltip display processors.
function processFrames(frames: DataFrame[]): DataFrame[] {
  return applyFieldOverrides({
    data: frames,
    fieldConfig,
    fieldConfigRegistry: plugin.fieldConfigRegistry,
    replaceVariables: (v) => v,
    theme: createTheme(),
    timeZone: 'utc',
  });
}

const validFrame = processFrames([
  createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1000, 2000, 3000], config: {} },
      { name: 'state', type: FieldType.string, values: ['ok', 'warn', 'ok'], config: {} },
    ],
  }),
])[0];

async function renderStatusHistoryPanel(
  options?: Partial<Options>,
  series: DataFrame[] = [validFrame],
  propsOverrides?: Partial<{ width: number }>
) {
  const props = getPanelProps<Options>(
    { ...baseOptions, ...options },
    {
      data: { state: LoadingState.Done, series, timeRange: getDefaultTimeRange() },
      fieldConfig,
      ...propsOverrides,
    }
  );
  // uPlot commits scales in a microtask, which updates OutsideRangePlugin's React state.
  await act(async () => {
    render(<StatusHistoryPanel {...props} />);
  });
}

describe('StatusHistoryPanel', () => {
  it('renders the chart when data is valid', async () => {
    await renderStatusHistoryPanel();

    expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeInTheDocument();
  });

  describe('null values in the time field (#130379)', () => {
    // A frame whose time field carries null cells must route to the error view
    // instead of reaching the chart, where zoom-to-data would propagate a null
    // timestamp into the dashboard time range and crash range parsing.
    const frameWithNullTime = processFrames([
      createDataFrame({
        refId: 'A',
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, null, 3000], config: {} },
          { name: 'state', type: FieldType.string, values: ['ok', 'warn', 'ok'], config: {} },
        ],
      }),
    ])[0];

    it('renders the error view instead of the chart when a time cell is null', async () => {
      await renderStatusHistoryPanel(undefined, [frameWithNullTime]);

      expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
      expect(screen.getByText(/Unable to render data/)).toBeVisible();
      expect(screen.getByText(/Query A returned a time field with null values/i)).toBeVisible();
    });
  });

  it('shows the error view when there is no time field', async () => {
    const noTimeFrame = createDataFrame({
      fields: [{ name: 'state', type: FieldType.string, values: ['ok'], config: {} }],
    });

    await renderStatusHistoryPanel(undefined, [noTimeFrame]);

    expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
    expect(screen.getByText(/Unable to render/i)).toBeInTheDocument();
  });

  it('shows the "too many points" message when the frame is too wide for the panel', async () => {
    // width/2 = 1, and the frame has 3 points, so the status grid cannot fit.
    await renderStatusHistoryPanel(undefined, [validFrame], { width: 2 });

    expect(screen.getByText(/Too many points/i)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
  });

  it('renders TooltipPlugin2 when tooltip mode is not None', async () => {
    // Hide the legend so chart rendering does not wait for legend measurement.
    await renderStatusHistoryPanel({
      legend: { ...baseOptions.legend, showLegend: false },
      tooltip: { ...baseOptions.tooltip, mode: TooltipDisplayMode.Single },
    });

    expect(screen.getByTestId('status-history-tooltip-plugin')).toBeInTheDocument();
  });

  it('renders the chart without a legend when displayMode is hidden, even if showLegend is true', async () => {
    await renderStatusHistoryPanel({
      legend: { ...baseOptions.legend, showLegend: true, displayMode: LegendDisplayMode.Hidden },
    });

    expect(screen.queryByTestId(selectors.components.VizLayout.legend)).not.toBeInTheDocument();
    expect(screen.getByTestId('status-history-tooltip-plugin')).toBeInTheDocument();
  });

  it('does not render TooltipPlugin2 when tooltip mode is None', async () => {
    await renderStatusHistoryPanel({
      legend: { ...baseOptions.legend, showLegend: false },
      tooltip: { ...baseOptions.tooltip, mode: TooltipDisplayMode.None },
    });

    expect(screen.queryByTestId('status-history-tooltip-plugin')).not.toBeInTheDocument();
  });
});
