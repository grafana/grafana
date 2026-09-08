import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createDataFrame, type DataFrame, DataFrameType, EventBusSrv, FieldType, type PanelProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { PanelContextProvider } from '@grafana/ui';

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

const labeledFrame = createDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000], config: {} },
    {
      name: 'cpu',
      type: FieldType.number,
      values: [1, 2, 3],
      config: { custom: {} },
      labels: { host: 'a' },
    },
    {
      name: 'mem',
      type: FieldType.number,
      values: [4, 5, 6],
      config: { custom: {} },
      labels: { host: 'b' },
    },
  ],
});

function renderPanel(options?: Partial<Options>, series: DataFrame[] = [validFrame]) {
  const props = getPanelProps<Options>({ ...defaultOptions, ...options });
  props.data.series = series;
  return render(<TimeSeriesPanel {...props} />);
}

function renderPanelWithFacetedFilter(
  optionsOverride: Partial<Options> = {},
  propsOverrides: Partial<Omit<PanelProps<Options>, 'options'>> = {}
) {
  const onOptionsChange = jest.fn();
  const props = getPanelProps<Options>(
    {
      ...defaultOptions,
      ...optionsOverride,
      legend: {
        ...defaultOptions.legend,
        enableFacetedFilter: true,
        ...(optionsOverride.legend ?? {}),
      },
    },
    { onOptionsChange, ...propsOverrides }
  );
  props.data.series = [labeledFrame];

  const renderResult = render(
    <PanelContextProvider
      value={{
        eventsScope: 'test',
        eventBus: new EventBusSrv(),
        onToggleSeriesVisibility: jest.fn(),
      }}
    >
      <TimeSeriesPanel {...props} />
    </PanelContextProvider>
  );

  return { onOptionsChange, props, ...renderResult };
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

  describe('faceted filter pin-to-sidebar persistence', () => {
    it('calls onOptionsChange with facetedFilterPinned: true when "Pin to sidebar" is clicked', async () => {
      const { onOptionsChange, props } = renderPanelWithFacetedFilter();

      await userEvent.click(screen.getByTestId('faceted-labels-filter-toggle'));
      const popover = screen.getByTestId('toggletip-content');
      await userEvent.click(within(popover).getByText('Pin to sidebar'));

      expect(onOptionsChange).toHaveBeenCalledTimes(1);
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...props.options,
        legend: { ...props.options.legend, facetedFilterPinned: true },
      });
    });

    it('renders the docked layout and calls onOptionsChange with facetedFilterPinned: false when "Unpin" is clicked', async () => {
      const { onOptionsChange, props } = renderPanelWithFacetedFilter({
        legend: { ...defaultOptions.legend, enableFacetedFilter: true, facetedFilterPinned: true },
      });

      expect(screen.queryByTestId('faceted-labels-filter-toggle')).not.toBeInTheDocument();
      const unpinButton = screen.getByLabelText('Unpin');
      expect(unpinButton).toBeInTheDocument();

      await userEvent.click(unpinButton);

      expect(onOptionsChange).toHaveBeenCalledTimes(1);
      expect(onOptionsChange).toHaveBeenCalledWith({
        ...props.options,
        legend: { ...props.options.legend, facetedFilterPinned: false },
      });
    });
  });

  describe('TimeComparison high cardinality (#126181)', () => {
    function makePodFrame(pod: string, opts: { compare?: boolean } = {}) {
      return createDataFrame({
        refId: opts.compare ? 'A-compare' : 'A',
        meta: opts.compare ? { timeCompare: { isTimeShiftQuery: true, diffMs: -86400000 } } : undefined,
        fields: [
          { name: 'time', type: FieldType.time, values: [1000, 2000, 3000], config: {} },
          {
            name: 'Value',
            type: FieldType.number,
            values: [1, 2, 3],
            labels: { pod },
            config: { custom: {} },
          },
        ],
      });
    }

    it('renders compare legend names for reordered high-cardinality series', () => {
      // Current: a, b. Compare window: b, a (reordered) — the #126181 mismatch scenario.
      // Color pairing is covered in utils.test.ts; here we lock the visible legend contract:
      // names stay tied to labels (with " (comparison)"), and compare series use dashed icons.
      renderPanel(undefined, [
        makePodFrame('a'),
        makePodFrame('b'),
        makePodFrame('b', { compare: true }),
        makePodFrame('a', { compare: true }),
      ]);

      expect(screen.getByTestId(selectors.components.VizLayout.legend)).toBeInTheDocument();

      for (const label of ['a', 'b', 'a (comparison)', 'b (comparison)']) {
        expect(screen.getByTestId(selectors.components.VizLegend.seriesName(label))).toBeInTheDocument();
      }

      const currentIcon = within(screen.getByTestId(selectors.components.VizLegend.seriesName('a'))).getByTestId(
        'series-icon'
      );
      const compareIcon = within(
        screen.getByTestId(selectors.components.VizLegend.seriesName('a (comparison)'))
      ).getByTestId('series-icon');

      // Solid current-period icon vs dashed compare icon (lineStyle from alignTimeRangeCompareData).
      expect(currentIcon.style.borderRadius).toBeTruthy();
      expect(compareIcon.style.backgroundSize).toBe('6px 4px');
    });
  });
});
