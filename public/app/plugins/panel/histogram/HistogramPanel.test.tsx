import { render, screen } from '@testing-library/react';

import {
  createDataFrame,
  createTheme,
  type DataFrame,
  FieldType,
  getDefaultTimeRange,
  getDisplayProcessor,
  LoadingState,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { HistogramPanel } from './HistogramPanel';
import { defaultOptions, type Options } from './panelcfg.gen';

jest.mock('@grafana/ui', () => {
  return {
    ...jest.requireActual('@grafana/ui'),
    TooltipPlugin2: (props: {
      render?: (
        u: unknown,
        dataIdxs: Array<number | null>,
        seriesIdx: number | null,
        isPinned?: boolean
      ) => React.ReactNode;
    }) => {
      const content = props.render?.({}, [0, 0], 0, false);
      return <div data-testid="histogram-tooltip-plugin">{content}</div>;
    },
  };
});

const rawValuesFrame = createDataFrame({
  fields: [
    {
      name: 'values',
      type: FieldType.number,
      values: [1, 2, 3, 4, 5, 10, 15, 20],
    },
  ],
});

/** Pre-bucketed histogram frame (xMin, xMax, count) - triggers getHistogramFields path when series.length === 1 */
const explicitHistogramFrame = stampFrameWithDisplay(
  createDataFrame({
    fields: [
      { name: 'xMin', type: FieldType.number, values: [0, 1, 2, 3] },
      { name: 'xMax', type: FieldType.number, values: [1, 2, 3, 4] },
      { name: 'count', type: FieldType.number, values: [5, 10, 15, 20], config: {} },
    ],
  })
);

const defaultPanelOptions: Options = {
  ...defaultOptions,
  combine: true,
  legend: {
    showLegend: false,
    displayMode: LegendDisplayMode.List,
    placement: 'bottom',
    calcs: [],
  },
  tooltip: {
    mode: TooltipDisplayMode.Single,
    // @ts-expect-error @todo mock grafana schema
    sort: 'none',
  },
};

describe('HistogramPanel', () => {
  const setUp = (dataOverrides?: Partial<{ series: DataFrame[] }>, optionsOverrides?: Partial<Options>) => {
    const mergedOptions = { ...defaultPanelOptions, ...optionsOverrides };
    const props = getPanelProps<Options>(mergedOptions, {
      data: {
        state: LoadingState.Done,
        series: [rawValuesFrame, rawValuesFrame],
        timeRange: getDefaultTimeRange(),
        ...dataOverrides,
      },
    });
    return render(<HistogramPanel {...props} />);
  };

  it('renders', () => {
    setUp();

    expect(screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container)).toBeVisible();
  });

  it('shows no data message when series is empty', () => {
    setUp({ series: [] });

    expect(screen.getByText('No histogram found in response')).toBeVisible();
  });

  it('renders TooltipPlugin2 when tooltip mode is not None', () => {
    setUp(undefined, {
      tooltip: {
        mode: TooltipDisplayMode.Single,
        //@ts-expect-error
        sort: 'none',
      },
    });

    expect(screen.getByTestId('histogram-tooltip-plugin')).toBeVisible();
  });

  it('does not render TooltipPlugin2 when tooltip mode is None', () => {
    setUp(undefined, {
      tooltip: {
        mode: TooltipDisplayMode.None,
        //@ts-expect-error
        sort: 'none',
      },
    });

    expect(screen.queryByTestId('histogram-tooltip-plugin')).not.toBeInTheDocument();
  });

  it('renders HistogramTooltip with bucket range and count content', () => {
    setUp(
      { series: [explicitHistogramFrame] },
      {
        tooltip: {
          mode: TooltipDisplayMode.Multi,
          //@ts-expect-error
          sort: 'none',
        },
      }
    );

    expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
    expect(screen.getByText('Bucket')).toBeVisible();
    expect(screen.getByText('0 - 1')).toBeVisible();
    expect(screen.getByText('count')).toBeVisible();
    expect(screen.getByText('5')).toBeVisible();
  });

  it('renders histogram from explicit histogram fields via getHistogramFields when series has one frame', () => {
    setUp({ series: [explicitHistogramFrame] });

    expect(screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container)).toBeVisible();
    expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
    expect(screen.getByText('Bucket')).toBeVisible();
    expect(screen.getByText('0 - 1')).toBeVisible();
  });
});

function stampFrameWithDisplay(frame: DataFrame): DataFrame {
  const theme = createTheme();
  frame.fields.forEach((field) => {
    if (!field.display) {
      field.display = getDisplayProcessor({ field, theme });
    }
  });
  return frame;
}
