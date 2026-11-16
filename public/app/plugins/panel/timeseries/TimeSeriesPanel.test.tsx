import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  applyFieldOverrides,
  createDataFrame,
  createTheme,
  type DataFrame,
  DataFrameType,
  dateTime,
  EventBusSrv,
  FieldConfigOptionsRegistry,
  FieldType,
  getDefaultTimeRange,
  type PanelProps,
} from '@grafana/data';
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

  it('does not render the exemplar overlay when there are no annotations', async () => {
    renderPanel();

    const chart = await screen.findByTestId('uplot-main-div');
    await waitFor(() => expect(chart.querySelector('.u-over')).toBeVisible());
    expect(screen.queryByTestId(selectors.components.UPlotChart.xyCanvas)).not.toBeInTheDocument();
  });

  it('renders exemplar markers when annotations arrive after the chart initializes without a programmatic request', async () => {
    const from = Date.UTC(2026, 9, 15, 10);
    const to = Date.UTC(2026, 9, 15, 11);
    const props = getPanelProps(
      { ...defaultOptions, legend: { ...defaultOptions.legend, showLegend: false } },
      {
        timeRange: {
          from: dateTime(from),
          to: dateTime(to),
          raw: { from: dateTime(from), to: dateTime(to) },
        },
      }
    );
    const time = (from + to) / 2;
    const [series, exemplar] = applyFieldOverrides({
      data: [
        createDataFrame({
          fields: [
            { name: 'Time', type: FieldType.time, values: [from, time, to] },
            { name: 'Value', type: FieldType.number, values: [10, 20, 30], labels: {}, config: { custom: {} } },
          ],
        }),
        createDataFrame({
          name: 'exemplar',
          fields: [
            { name: 'Time', type: FieldType.time, values: [time] },
            { name: 'Value', type: FieldType.number, values: [20] },
            { name: 'traceID', type: FieldType.string, values: ['late-annotation-trace'] },
          ],
        }),
      ],
      fieldConfig: { defaults: {}, overrides: [] },
      replaceVariables: (value) => value,
      theme: createTheme(),
      fieldConfigRegistry: new FieldConfigOptionsRegistry(),
    });
    props.data = { ...props.data, series: [series], annotations: undefined };
    const { rerender } = render(<TimeSeriesPanel {...props} />);
    const chart = await screen.findByTestId('uplot-main-div');
    await waitFor(() => expect(chart.querySelector('.u-over')).toBeVisible());

    rerender(<TimeSeriesPanel {...props} data={{ ...props.data, annotations: [exemplar] }} />);

    const marker = await screen.findByTestId(selectors.components.DataSource.Prometheus.exemplarMarker);
    await userEvent.click(marker);
    expect(await screen.findByText('late-annotation-trace')).toBeVisible();
  });

  it.each([false, true])(
    'opens exemplars with an all-null metric series (programmatic request: %s)',
    async (programmatic) => {
      const from = Date.UTC(2026, 9, 15, 10);
      const to = from + 60_000;
      const time = from + 30_000;
      const props = getPanelProps(
        { ...defaultOptions, legend: { ...defaultOptions.legend, showLegend: false } },
        {
          timeRange: {
            from: dateTime(from),
            to: dateTime(to),
            raw: { from: dateTime(from), to: dateTime(to) },
          },
        }
      );
      const [series, exemplar] = applyFieldOverrides({
        data: [
          createDataFrame({
            fields: [
              { name: 'Time', type: FieldType.time, values: [from, to] },
              { name: 'Value', type: FieldType.number, values: [null, null], labels: {}, config: { custom: {} } },
            ],
          }),
          createDataFrame({
            name: 'exemplar',
            fields: [
              { name: 'Time', type: FieldType.time, values: [time] },
              { name: 'Value', type: FieldType.number, values: [62.514141] },
              { name: 'traceID', type: FieldType.string, values: ['query-sample-trace'] },
            ],
          }),
        ],
        fieldConfig: { defaults: {}, overrides: [] },
        replaceVariables: (value) => value,
        theme: createTheme(),
        fieldConfigRegistry: new FieldConfigOptionsRegistry(),
      });
      props.data = { ...props.data, series: [series], annotations: [exemplar] };
      let pending = programmatic;
      const onHandled = jest.fn(() => {
        pending = false;
      });
      const context = {
        eventsScope: 'test',
        eventBus: new EventBusSrv(),
        openExemplar: programmatic
          ? {
              getRequest: () => (pending ? { requestId: 'query-sample', frameIndex: 0, rowIndex: 0 } : undefined),
              onHandled,
            }
          : undefined,
      };
      const { rerender } = render(
        <PanelContextProvider value={context}>
          <TimeSeriesPanel {...props} />
        </PanelContextProvider>
      );

      const marker = await screen.findByTestId(selectors.components.DataSource.Prometheus.exemplarMarker);
      expect(marker.parentElement).toHaveStyle({ top: '0px' });
      if (!programmatic) {
        await userEvent.click(marker);
      }
      expect(await screen.findByText('query-sample-trace')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
      if (programmatic) {
        expect(onHandled).toHaveBeenCalledWith('query-sample');
      }
      await userEvent.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByText('query-sample-trace')).not.toBeInTheDocument();

      const populatedSeries = {
        ...series,
        fields: series.fields.map((field) =>
          field.type === FieldType.number ? { ...field, values: [20, 100] } : field
        ),
      };
      rerender(
        <PanelContextProvider value={context}>
          <TimeSeriesPanel {...props} data={{ ...props.data, series: [populatedSeries] }} />
        </PanelContextProvider>
      );
      await waitFor(() => {
        const position = screen.getByTestId(selectors.components.DataSource.Prometheus.exemplarMarker).parentElement!;
        expect(parseFloat(position.style.top)).toBeGreaterThan(0);
        expect(parseFloat(position.style.top)).toBeLessThan(props.height);
      });
      expect(screen.queryByText('query-sample-trace')).not.toBeInTheDocument();
    }
  );

  it('does not retry a pending exemplar request on an unrelated panel render', async () => {
    const props = getPanelProps({ ...defaultOptions, legend: { ...defaultOptions.legend, showLegend: false } });
    props.data.series = [validFrame];
    props.data.annotations = [validFrame];
    const getRequest = jest.fn(() => undefined);
    const context = {
      eventsScope: 'test',
      eventBus: new EventBusSrv(),
      openExemplar: { getRequest, onHandled: jest.fn() },
    };
    const { rerender } = render(
      <PanelContextProvider value={context}>
        <TimeSeriesPanel {...props} />
      </PanelContextProvider>
    );
    await act(() => Promise.resolve());
    await waitFor(() => expect(getRequest).toHaveBeenCalledWith([validFrame]));
    const attempts = getRequest.mock.calls.length;

    rerender(
      <PanelContextProvider value={context}>
        <TimeSeriesPanel {...props} title="Updated panel title" />
      </PanelContextProvider>
    );

    expect(getRequest).toHaveBeenCalledTimes(attempts);
  });

  it('opens a retained exemplar request when annotations arrive late and follows series visibility updates', async () => {
    const from = Date.UTC(2026, 9, 15, 10);
    const to = Date.UTC(2026, 9, 15, 11);
    const props = getPanelProps(
      { ...defaultOptions, legend: { ...defaultOptions.legend, showLegend: false } },
      {
        timeRange: {
          from: dateTime(from),
          to: dateTime(to),
          raw: { from: dateTime(from), to: dateTime(to) },
        },
      }
    );
    const time = (from + to) / 2;
    const [series, exemplar] = applyFieldOverrides({
      data: [
        createDataFrame({
          fields: [
            { name: 'Time', type: FieldType.time, values: [from, time, to] },
            { name: 'Value', type: FieldType.number, values: [10, 20, 30], labels: {}, config: { custom: {} } },
          ],
        }),
        createDataFrame({
          name: 'exemplar',
          fields: [
            { name: 'Time', type: FieldType.time, values: [time] },
            { name: 'Value', type: FieldType.number, values: [20] },
            { name: 'traceID', type: FieldType.string, values: ['late-annotation-trace'] },
          ],
        }),
      ],
      fieldConfig: { defaults: {}, overrides: [] },
      replaceVariables: (value) => value,
      theme: createTheme(),
      fieldConfigRegistry: new FieldConfigOptionsRegistry(),
    });
    props.data = { ...props.data, series: [series], annotations: undefined };
    let pending = true;
    const onHandled = jest.fn(() => {
      pending = false;
    });
    const context = {
      eventsScope: 'test',
      eventBus: new EventBusSrv(),
      openExemplar: {
        getRequest: () => (pending ? { requestId: 'late-annotations', frameIndex: 0, rowIndex: 0 } : undefined),
        onHandled,
      },
    };
    const { rerender } = render(
      <PanelContextProvider value={context}>
        <TimeSeriesPanel {...props} />
      </PanelContextProvider>
    );
    const chart = await screen.findByTestId('uplot-main-div');
    await waitFor(() => expect(chart.querySelector('.u-over')).toBeVisible());
    const plotOverlay = chart.querySelector('.u-over');
    expect(onHandled).not.toHaveBeenCalled();

    rerender(
      <PanelContextProvider value={context}>
        <TimeSeriesPanel {...props} data={{ ...props.data, annotations: [exemplar] }} />
      </PanelContextProvider>
    );

    expect(await screen.findByText('late-annotation-trace')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible();
    expect(chart.querySelector('.u-over')).toBe(plotOverlay);
    expect(onHandled).toHaveBeenCalledTimes(1);
    expect(onHandled).toHaveBeenCalledWith('late-annotations');

    const hiddenSeries = {
      ...series,
      fields: series.fields.map((field) => ({
        ...field,
        config: { ...field.config, custom: { ...field.config.custom, hideFrom: { viz: true } } },
      })),
    };
    rerender(
      <PanelContextProvider value={context}>
        <TimeSeriesPanel {...props} data={{ ...props.data, series: [hiddenSeries], annotations: [exemplar] }} />
      </PanelContextProvider>
    );
    expect(screen.queryByText('late-annotation-trace')).not.toBeInTheDocument();

    rerender(
      <PanelContextProvider value={context}>
        <TimeSeriesPanel {...props} data={{ ...props.data, annotations: [exemplar] }} />
      </PanelContextProvider>
    );
    expect(await screen.findByText('late-annotation-trace')).toBeVisible();
    expect(onHandled).toHaveBeenCalledTimes(1);
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

  it('should hide legend when displayMode is hidden, even if showLegend is true', () => {
    renderPanel({ legend: { ...defaultOptions.legend, showLegend: true, displayMode: LegendDisplayMode.Hidden } });

    expect(screen.getByTestId(selectors.components.UPlotChart.container)).toBeInTheDocument();
    expect(screen.queryByTestId(selectors.components.VizLayout.legend)).not.toBeInTheDocument();
  });

  describe('null values in the time field (#130379)', () => {
    // A frame whose time field carries null cells must route to the error view
    // instead of reaching the chart, where zoom-to-data would propagate a null
    // timestamp into the dashboard time range and crash range parsing.
    const frameWithNullTime = createDataFrame({
      refId: 'A',
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, null, 3000], config: {} },
        { name: 'value', type: FieldType.number, values: [10, 20, 30], config: { custom: {} } },
      ],
    });

    it('renders the error view instead of the chart when a time cell is null', () => {
      renderPanel(undefined, [frameWithNullTime]);

      expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
      expect(screen.getByText(/Unable to render data/)).toBeVisible();
      expect(screen.getByText(/query A returned a time field with null values/i)).toBeVisible();
    });
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
    const DAY_MS = 24 * 60 * 60 * 1000;

    function makePodFrame(pod: string, opts: { compare?: boolean; times?: number[] } = {}) {
      return createDataFrame({
        refId: opts.compare ? 'A-compare' : 'A',
        meta: opts.compare ? { timeCompare: { isTimeShiftQuery: true, diffMs: -DAY_MS } } : undefined,
        fields: [
          { name: 'time', type: FieldType.time, values: opts.times ?? [1000, 2000, 3000], config: {} },
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

    it('renders compare series that have no current-period counterpart inside the range (#132370)', async () => {
      // The current period returned nothing, so the compare frames arrive on their own, still sitting
      // a day back. Unshifted they fall outside the panel range and the panel renders the outside-range
      // fallback instead of the series - the symptom users report. The frames are built one comparison
      // period behind the range getPanelProps renders with, so shifting them lands inside it; fixed
      // timestamps would sit outside the range whether or not the shift happened.
      const { from, to } = getDefaultTimeRange();
      const comparePeriod = [from.valueOf(), (from.valueOf() + to.valueOf()) / 2, to.valueOf()].map(
        (time) => time - DAY_MS
      );

      renderPanel(undefined, [
        makePodFrame('a', { compare: true, times: comparePeriod }),
        makePodFrame('b', { compare: true, times: comparePeriod }),
      ]);

      // The fallback only appears once uPlot has drawn and reported its x scale, so asserting its
      // absence before that would pass no matter what the panel did.
      await waitFor(() =>
        expect(screen.getByTestId(selectors.components.VizLayout.container).querySelector('.u-over')).toBeVisible()
      );
      expect(screen.queryByText('Data outside time range')).not.toBeInTheDocument();

      // Shifted, but still identifiable as comparison data rather than the current period.
      for (const label of ['a (comparison)', 'b (comparison)']) {
        const icon = within(screen.getByTestId(selectors.components.VizLegend.seriesName(label))).getByTestId(
          'series-icon'
        );
        expect(icon.style.backgroundSize).toBe('6px 4px');
      }
    });
  });
});
