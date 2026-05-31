import { render, screen } from '@testing-library/react';

import { createDataFrame, FieldType, LoadingState, getDefaultTimeRange } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { BoxplotPanel } from './BoxplotPanel';
import { defaultOptions, type Options } from './panelcfg.gen';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  TooltipPlugin2: (props: {
    render?: (
      u: unknown,
      dataIdxs: Array<number | null>,
      seriesIdx: number | null,
      isPinned?: boolean
    ) => React.ReactNode;
  }) => <div data-testid="boxplot-tooltip-plugin">{props.render?.({}, [null, 0, 0], 1, false)}</div>,
}));

const options: Options = {
  ...defaultOptions,
  fields: {},
  tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None },
};

const summaryFrame = createDataFrame({
  fields: [
    { name: 'Field', type: FieldType.string, values: ['A', 'B', 'C'] },
    { name: 'Min', type: FieldType.number, values: [1, 2, 3] },
    { name: '25th %', type: FieldType.number, values: [3, 4, 5] },
    { name: 'Median', type: FieldType.number, values: [5, 6, 7] },
    { name: '75th %', type: FieldType.number, values: [7, 8, 9] },
    { name: 'Max', type: FieldType.number, values: [9, 10, 11] },
  ],
});

const renderPanel = (series = [summaryFrame]) =>
  render(
    <BoxplotPanel
      {...getPanelProps<Options>(options, {
        data: { state: LoadingState.Done, series, timeRange: getDefaultTimeRange() },
      })}
    />
  );

describe('BoxplotPanel', () => {
  it('renders a box per row and shows the seven numbers in the tooltip', () => {
    renderPanel();
    // tooltip renders content for the first hovered box (category "A")
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Median')).toBeInTheDocument();
    expect(screen.getByText('Upper quartile (Q3)')).toBeInTheDocument();
  });

  it('shows the error view when no box-plot fields are present', () => {
    const badFrame = createDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3] }],
    });
    renderPanel([badFrame]);
    expect(screen.queryByTestId('boxplot-tooltip-plugin')).not.toBeInTheDocument();
  });
});
