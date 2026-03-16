import { render, screen } from '@testing-library/react';

import { createDataFrame, DataFrame, FieldType, getDefaultTimeRange, LoadingState } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { HistogramPanel } from './HistogramPanel';
import { defaultOptions, Options } from './panelcfg.gen';

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

    expect(screen.getByTestId(selectors.components.Panels.Visualization.Histogram.container)).toBeInTheDocument();
  });

  it('renders TooltipPlugin2 when tooltip mode is not None', () => {
    setUp(undefined, {
      tooltip: {
        mode: TooltipDisplayMode.Single,
        //@ts-expect-error
        sort: 'none',
      },
    });

    expect(screen.getByTestId('histogram-tooltip-plugin')).toBeInTheDocument();
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

  it('renders HistogramTooltip', () => {
    setUp(undefined, {
      tooltip: {
        mode: TooltipDisplayMode.Single,
        //@ts-expect-error
        sort: 'none',
      },
    });

    expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeInTheDocument();
  });
});
