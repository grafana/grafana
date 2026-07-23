import { render, screen } from '@testing-library/react';
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

import { StateTimelinePanel } from './StateTimelinePanel';
import { defaultOptions, type Options } from './panelcfg.gen';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  // Invoke the panel's render-prop (as the real plugin does on hover) so the tooltip body is exercised.
  TooltipPlugin2: (props: { render?: (...args: unknown[]) => ReactNode }) => {
    const u = { posToVal: () => 0, cursor: { left: 0 } };
    const content = props.render?.(u, [0, 0], 1, false, jest.fn(), null, false, []);
    return <div data-testid="state-timeline-tooltip-plugin">{content}</div>;
  },
}));

const baseOptions: Options = {
  ...defaultOptions,
  legend: { showLegend: true, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
  tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None, maxWidth: 300, maxHeight: 300, hideZeros: false },
} as Options;

// applyFieldOverrides attaches the display processors the timeline legend/tooltip helpers rely on;
// in real usage this happens in the data pipeline before the panel renders.
function processFrames(frames: DataFrame[]): DataFrame[] {
  return applyFieldOverrides({
    data: frames,
    fieldConfig: { defaults: {}, overrides: [] },
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

function renderStateTimelinePanel(options?: Partial<Options>, series: DataFrame[] = [validFrame]) {
  const props = getPanelProps<Options>(
    { ...baseOptions, ...options },
    { data: { state: LoadingState.Done, series, timeRange: getDefaultTimeRange() } }
  );
  return render(<StateTimelinePanel {...props} />);
}

describe('StateTimelinePanel', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('renders the chart when data is valid', () => {
    renderStateTimelinePanel();

    expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeInTheDocument();
  });

  it('shows the error view when there is no time field', () => {
    const noTimeFrame = createDataFrame({
      fields: [{ name: 'state', type: FieldType.string, values: ['ok'], config: {} }],
    });

    renderStateTimelinePanel(undefined, [noTimeFrame]);

    expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
    expect(screen.getByText(/Unable to render/i)).toBeInTheDocument();
  });

  it('renders when mergeValues is disabled', () => {
    renderStateTimelinePanel({ mergeValues: false });

    expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeInTheDocument();
  });

  it('renders TooltipPlugin2 when tooltip mode is not None', () => {
    // Legend hidden so VizLayout renders the chart (and its plugin render-prop) synchronously in jsdom.
    renderStateTimelinePanel({
      legend: { ...baseOptions.legend, showLegend: false },
      tooltip: { ...baseOptions.tooltip, mode: TooltipDisplayMode.Single },
    });

    expect(screen.getByTestId('state-timeline-tooltip-plugin')).toBeInTheDocument();
  });

  it('does not render TooltipPlugin2 when tooltip mode is None', () => {
    renderStateTimelinePanel({
      legend: { ...baseOptions.legend, showLegend: false },
      tooltip: { ...baseOptions.tooltip, mode: TooltipDisplayMode.None },
    });

    expect(screen.queryByTestId('state-timeline-tooltip-plugin')).not.toBeInTheDocument();
  });
});
