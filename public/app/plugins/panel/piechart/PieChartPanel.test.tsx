import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';

import {
  type FieldConfig,
  type FieldConfigSource,
  type FieldDisplay,
  FieldColorModeId,
  toDataFrame,
  FieldType,
  VizOrientation,
  LoadingState,
  getDefaultTimeRange,
  EventBusSrv,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';

import { PieChartPanel, comparePieChartItemsByValue } from './PieChartPanel';
import {
  type Options,
  type PieChartLegendOptions,
  PieChartType,
  PieChartLegendValues,
  PieChartLabels,
} from './panelcfg.gen';

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: () => [() => {}, { width: 100, height: 100 }],
}));

type PieChartPanelProps = ComponentProps<typeof PieChartPanel>;

describe('PieChartPanel', () => {
  beforeEach(() => {
    Object.defineProperty(global, 'ResizeObserver', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      })),
    });
  });

  describe('series overrides - Hide in area', () => {
    const defaultConfig = {
      custom: {
        hideFrom: {
          legend: false,
          viz: false,
          tooltip: false,
        },
      },
    };

    describe('when no hiding', () => {
      const seriesWithNoOverrides = [
        toDataFrame({
          fields: [
            { name: 'Chrome', config: defaultConfig, type: FieldType.number, values: [60] },
            { name: 'Firefox', config: defaultConfig, type: FieldType.number, values: [20] },
            { name: 'Safari', config: defaultConfig, type: FieldType.number, values: [20] },
          ],
        }),
      ];

      it('should not filter out any slices or legend items', () => {
        setup({ data: { series: seriesWithNoOverrides } });

        const slices = screen.queryAllByTestId('data testid Pie Chart Slice');
        expect(slices.length).toBe(3);
        expect(screen.queryByText(/Chrome/i)).toBeInTheDocument();
        expect(screen.queryByText(/Firefox/i)).toBeInTheDocument();
        expect(screen.queryByText(/Safari/i)).toBeInTheDocument();
      });
    });

    describe('when series override to hide viz', () => {
      const hideVizConfig = {
        custom: {
          hideFrom: {
            legend: false,
            viz: true,
            tooltip: false,
          },
        },
      };

      const seriesWithFirefoxOverride = [
        toDataFrame({
          fields: [
            { name: 'Chrome', config: defaultConfig, type: FieldType.number, values: [60] },
            { name: 'Firefox', config: hideVizConfig, type: FieldType.number, values: [20] },
            { name: 'Safari', config: defaultConfig, type: FieldType.number, values: [20] },
          ],
        }),
      ];

      it('should filter out the Firefox pie chart slice but not the legend', () => {
        setup({ data: { series: seriesWithFirefoxOverride } });

        const slices = screen.queryAllByTestId('data testid Pie Chart Slice');
        expect(slices.length).toBe(2);
        expect(screen.queryByText(/Firefox/i)).toBeInTheDocument();
      });
    });

    describe('when series override to hide tooltip', () => {
      const hideTooltipConfig = {
        custom: {
          hideFrom: {
            legend: false,
            viz: false,
            tooltip: true,
          },
        },
      };

      const seriesWithFirefoxOverride = [
        toDataFrame({
          fields: [
            { name: 'Chrome', config: defaultConfig, type: FieldType.number, values: [600] },
            { name: 'Firefox', config: hideTooltipConfig, type: FieldType.number, values: [190] },
            { name: 'Safari', config: defaultConfig, type: FieldType.number, values: [210] },
          ],
        }),
      ];

      it('should filter out the Firefox series with value 190 from the multi tooltip', async () => {
        setup({ data: { series: seriesWithFirefoxOverride } });

        await userEvent.hover(screen.getAllByTestId('data testid Pie Chart Slice')[0]);
        expect(screen.queryByText(/600/i)).toBeInTheDocument();
        expect(screen.queryByText(/190/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/210/i)).toBeInTheDocument();

        expect(screen.queryByText(/Firefox/i)).toBeInTheDocument();
        const slices = screen.queryAllByTestId('data testid Pie Chart Slice');
        expect(slices.length).toBe(3);
      });
    });

    describe('keyboard accessibility for data links', () => {
      // These tests document the contract introduced when fixing the missing
      // focus-indicator bug (see DataLinksContextMenu/WithContextMenu): pie
      // slices that carry data links must be keyboard-focusable, announce the
      // correct role to assistive tech, and open via Enter/Space — without any
      // synthetic-MouseEvent dispatch in the panel.
      //
      // `getFieldDisplayValues` reads two pieces of state to populate
      // FieldDisplay.hasLinks/getLinks: `field.config.links` (count) and
      // `field.getLinks` (supplier function). In production both are set by
      // `applyFieldOverrides`. In tests we have to provide both manually.
      const buildLinkedFrame = (links: Array<{ title: string; url: string }>) => {
        const frame = toDataFrame({
          fields: [
            {
              name: 'Chrome',
              type: FieldType.number,
              values: [60],
              config: { ...defaultConfig, links },
            },
            { name: 'Firefox', config: defaultConfig, type: FieldType.number, values: [20] },
          ],
        });
        // Mirror what `applyFieldOverrides` would set: a supplier that returns
        // resolved `LinkModel`s for the given row.
        frame.fields[0].getLinks = () =>
          links.map((l) => ({ href: l.url, title: l.title, target: undefined, origin: frame.fields[0] }));
        return frame;
      };

      const seriesWithSingleLink = [buildLinkedFrame([{ title: 'Open dashboard', url: '/d/abc' }])];

      const seriesWithMultipleLinks = [
        buildLinkedFrame([
          { title: 'Open dashboard', url: '/d/abc' },
          { title: 'Open runbook', url: '/d/runbook' },
        ]),
      ];

      it('renders a focusable anchor wrapper for slices with a single data link', () => {
        setup({ data: { series: seriesWithSingleLink } });

        const singleLinks = screen.getAllByTestId(selectors.components.DataLinksContextMenu.singleLink);
        // One slice has a link, the other does not.
        expect(singleLinks).toHaveLength(1);
        // tagName is lowercase here because the `<a>` is parsed inside SVG
        // context — it becomes a native SVG anchor, which is keyboard-
        // focusable in all evergreen browsers.
        expect(singleLinks[0].tagName.toLowerCase()).toBe('a');
        expect(singleLinks[0]).toHaveAttribute('href', '/d/abc');
      });

      it('exposes role="button" + tabindex=0 + aria-haspopup on slices with multiple data links', () => {
        setup({ data: { series: seriesWithMultipleLinks } });

        // The legend also renders `role="button"` items per series, so we
        // disambiguate the slice trigger by `aria-haspopup="menu"` (only the
        // data-links trigger sets it).
        const trigger = screen
          .getAllByRole('button', { name: 'Chrome' })
          .find((el) => el.getAttribute('aria-haspopup') === 'menu');

        expect(trigger).toBeDefined();
        expect(trigger).toHaveAttribute('tabindex', '0');
      });

      it('does not add keyboard semantics to slices without data links', () => {
        const seriesWithoutLinks = [
          toDataFrame({
            fields: [
              { name: 'Chrome', config: defaultConfig, type: FieldType.number, values: [60] },
              { name: 'Firefox', config: defaultConfig, type: FieldType.number, values: [20] },
            ],
          }),
        ];
        setup({ data: { series: seriesWithoutLinks } });

        // The slice is plain — no `aria-haspopup` trigger, no single-link `<a>`.
        // (Legend items render their own `role="button"` controls; we explicitly
        // exclude them by also requiring `aria-haspopup="menu"`.)
        expect(
          screen.queryAllByRole('button').filter((el) => el.getAttribute('aria-haspopup') === 'menu')
        ).toHaveLength(0);
        expect(screen.queryAllByTestId(selectors.components.DataLinksContextMenu.singleLink)).toHaveLength(0);
      });

      it('opens the data-links context menu when Enter is pressed on a multi-link slice', async () => {
        // Regression test: this used to require the panel to fabricate a
        // synthetic `MouseEvent('click', { clientX, clientY })` from the
        // slice's bounding-box centre. The element-anchored `openMenu` overload
        // makes Enter/Space activation the responsibility of the shared
        // component, so the panel just spreads `triggerProps`.
        const user = userEvent.setup();
        setup({ data: { series: seriesWithMultipleLinks } });

        const trigger = screen
          .getAllByRole('button', { name: 'Chrome' })
          .find((el) => el.getAttribute('aria-haspopup') === 'menu')!;

        // The two link titles are not yet on screen.
        expect(screen.queryByText('Open dashboard')).not.toBeInTheDocument();
        expect(screen.queryByText('Open runbook')).not.toBeInTheDocument();

        await act(async () => {
          trigger.focus();
          await user.keyboard('{Enter}');
        });

        expect(screen.getByText('Open dashboard')).toBeInTheDocument();
        expect(screen.getByText('Open runbook')).toBeInTheDocument();
      });

      it('renders focusable anchor with focus-visible class for single-link slices', () => {
        setup({ data: { series: seriesWithSingleLink } });
        const singleLink = screen.getByTestId(selectors.components.DataLinksContextMenu.singleLink);
        // It should also have an href attribute
        expect(singleLink).toHaveAttribute('href', '/d/abc');
      });

      it('opens the context menu when Space is pressed on a multi-link slice', async () => {
        const user = userEvent.setup();
        setup({ data: { series: seriesWithMultipleLinks } });

        const trigger = screen
          .getAllByRole('button', { name: 'Chrome' })
          .find((el) => el.getAttribute('aria-haspopup') === 'menu')!;

        expect(screen.queryByText('Open dashboard')).not.toBeInTheDocument();
        await act(async () => {
          trigger.focus();
          await user.keyboard(' ');
        });

        expect(screen.getByText('Open dashboard')).toBeInTheDocument();
        expect(screen.getByText('Open runbook')).toBeInTheDocument();
      });

      it('does not apply triggerProps to slices without data links', () => {
        const seriesWithoutLinks = [
          toDataFrame({
            fields: [
              { name: 'Chrome', config: defaultConfig, type: FieldType.number, values: [60] },
              { name: 'Firefox', config: defaultConfig, type: FieldType.number, values: [20] },
            ],
          }),
        ];
        setup({ data: { series: seriesWithoutLinks } });

        const slices = screen.getAllByTestId('data testid Pie Chart Slice');
        slices.forEach((slice) => {
          expect(slice).not.toHaveAttribute('role', 'button');
          expect(slice).not.toHaveAttribute('aria-haspopup');
        });
      });
    });

    describe('when series override to hide legend', () => {
      const hideLegendConfig = {
        custom: {
          hideFrom: {
            legend: true,
            viz: false,
            tooltip: false,
          },
        },
      };

      const seriesWithFirefoxOverride = [
        toDataFrame({
          fields: [
            { name: 'Chrome', config: defaultConfig, type: FieldType.number, values: [60] },
            { name: 'Firefox', config: hideLegendConfig, type: FieldType.number, values: [20] },
            { name: 'Safari', config: defaultConfig, type: FieldType.number, values: [20] },
          ],
        }),
      ];

      it('should filter out the series from the legend but not the slice', () => {
        setup({ data: { series: seriesWithFirefoxOverride } });

        expect(screen.queryByText(/Firefox/i)).not.toBeInTheDocument();
        const slices = screen.queryAllByTestId('data testid Pie Chart Slice');
        expect(slices.length).toBe(3);
      });
    });
  });

  describe('display labels', () => {
    it('renders name, value, and percent text for each slice', () => {
      setup({
        options: buildOptions({ displayLabels: [PieChartLabels.Name, PieChartLabels.Value, PieChartLabels.Percent] }),
        data: { series: defaultSliceSeries },
      });
      const labels = screen.getAllByTestId(selectors.components.Panels.Visualization.PieChart.svgLabel);

      // Labels follow descending sort. Each label is name+value+percent joined without a separator.
      expect(labels).toHaveLength(2);
      expect(labels[0]).toHaveTextContent('Chrome6060%');
      expect(labels[1]).toHaveTextContent('Firefox4040%');
    });

    it('picks black or white label text for readability when gradientFills is active', () => {
      // Color must be set on field.config directly; the panel reads pre-resolved config,
      // it does not apply fieldConfig defaults itself (applyFieldOverrides does that in prod).
      const gradientColor = { mode: FieldColorModeId.Gradient, fixedColor: '#00ff00', gradientColorTo: '#ff0000' };
      const seriesWithGradientColor = makeSeries([
        { name: 'Chrome', value: 60, config: { color: gradientColor } },
        { name: 'Firefox', value: 40, config: { color: gradientColor } },
      ]);
      setup({
        options: buildOptions({ displayLabels: [PieChartLabels.Name] }),
        data: { series: seriesWithGradientColor },
      });
      const labels = screen.getAllByTestId(selectors.components.Panels.Visualization.PieChart.svgLabel);
      const labelFillColors = labels.map((el) => el.getAttribute('fill')?.toLowerCase());

      // Gradient mode picks black or white for contrast; any other color means it didn't run.
      expect(labelFillColors).toHaveLength(2);
      labelFillColors.forEach((color) => expect(['#ffffff', '#000000']).toContain(color));
    });

    it('suppresses the label for a slice too small to fit one (< 0.3 rad)', () => {
      // Tiny is ~1% of the total, well under the 0.3 rad label threshold.
      const seriesWithTinySlice = makeSeries([
        { name: 'Big', value: 990 },
        { name: 'Tiny', value: 10 },
      ]);
      setup({
        options: buildOptions({ displayLabels: [PieChartLabels.Name] }),
        data: { series: seriesWithTinySlice },
      });
      // Both slices render; only the Tiny label is dropped.
      expect(screen.getAllByTestId('data testid Pie Chart Slice')).toHaveLength(2);
      const labels = screen.getAllByTestId(selectors.components.Panels.Visualization.PieChart.svgLabel);
      expect(labels).toHaveLength(1);
      expect(labels[0]).toHaveTextContent('Big');
    });
  });

  describe('tooltip modes', () => {
    it('shows only the hovered series in single mode, not the whole series list', async () => {
      setup({
        options: buildOptions({ tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.Ascending } }),
        data: { series: defaultSliceSeries },
      });
      // Descending sort makes Chrome the first slice. Single mode shows only the hovered row.
      await userEvent.hover(screen.getAllByTestId('data testid Pie Chart Slice')[0]);

      const rows = screen.getAllByTestId('SeriesTableRow');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent('Chrome');
      expect(rows[0]).toHaveTextContent('60');
    });

    it('filters zero-value series from multi tooltip when hideZeros is enabled', async () => {
      const seriesWithZero = makeSeries([
        { name: 'Chrome', value: 60 },
        { name: 'Zero', value: 0 },
      ]);
      setup({
        options: buildOptions({
          tooltip: { mode: TooltipDisplayMode.Multi, sort: SortOrder.Ascending, hideZeros: true },
        }),
        data: { series: seriesWithZero },
      });
      await userEvent.hover(screen.getAllByTestId('data testid Pie Chart Slice')[0]);

      // Chrome stays; the zero-valued Zero series is not among the tooltip rows.
      const rows = screen.getAllByTestId('SeriesTableRow');
      expect(rows).toHaveLength(1);
      expect(rows[0]).toHaveTextContent('Chrome');
      expect(rows.some((row) => row.textContent?.includes('Zero'))).toBe(false);
    });

    it('hides the tooltip on mouseout after hover', async () => {
      setup({ data: { series: defaultSliceSeries } });
      const slices = screen.getAllByTestId('data testid Pie Chart Slice');

      // Multi mode (the default) shows a row per slice.
      await userEvent.hover(slices[0]);
      expect(screen.getAllByTestId('SeriesTableRow')).toHaveLength(2);

      fireEvent.mouseOut(slices[0]);
      expect(screen.queryAllByTestId('SeriesTableRow')).toHaveLength(0);
    });
  });

  describe('panel states', () => {
    it('renders the error view instead of a chart when there are no data frames', () => {
      setup({ data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] } });

      // No chart: neither the viz layout nor any slice is rendered.
      expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('data testid Pie Chart Slice')).toHaveLength(0);
    });

    it('does not render the legend when showLegend is false', () => {
      setup({
        options: buildOptions({ legend: buildLegend({ showLegend: false }) }),
        data: { series: defaultSliceSeries },
      });

      // Slices still render, but the legend region is not.
      expect(screen.getAllByTestId('data testid Pie Chart Slice')).toHaveLength(2);
      expect(screen.queryByTestId(selectors.components.VizLayout.legend)).not.toBeInTheDocument();
    });

    it('shows the raw value in the legend when legend values include Value', () => {
      // Table mode renders the value column; List mode would only show names.
      setup({
        options: buildOptions({
          legend: buildLegend({ displayMode: LegendDisplayMode.Table, values: [PieChartLegendValues.Value] }),
        }),
        data: { series: defaultSliceSeries },
      });

      // Scope to the legend so the value is tied to it, not to a slice label.
      const legend = screen.getByTestId(selectors.components.VizLayout.legend);
      expect(within(legend).getByText('Chrome')).toBeInTheDocument();
      expect(within(legend).getByText('60')).toBeInTheDocument();
    });
  });
});

describe('comparePieChartItemsByValue', () => {
  const makeFieldDisplay = (n: number) => ({ display: { numeric: n } }) as unknown as FieldDisplay;

  it.each([
    {
      name: 'always: NaN a sorts after 1',
      sort: SortOrder.Descending,
      a: makeFieldDisplay(NaN),
      b: makeFieldDisplay(1),
      expected: 1,
    },
    {
      name: 'always: NaN b sorts before 1',
      sort: SortOrder.Descending,
      a: makeFieldDisplay(1),
      b: makeFieldDisplay(NaN),
      expected: -1,
    },
    {
      name: 'descending: larger a sorts before smaller b (negative)',
      sort: SortOrder.Descending,
      a: makeFieldDisplay(10),
      b: makeFieldDisplay(5),
      expected: -5,
    },
    {
      name: 'ascending: smaller a sorts before larger b (negative)',
      sort: SortOrder.Ascending,
      a: makeFieldDisplay(5),
      b: makeFieldDisplay(10),
      expected: -5,
    },
    {
      name: 'none: comparator returns 0 regardless of values',
      sort: SortOrder.None,
      a: makeFieldDisplay(5),
      b: makeFieldDisplay(10),
      expected: 0,
    },
  ])('$name', ({ sort, a, b, expected }) => {
    const cmp = comparePieChartItemsByValue(sort);
    expect(cmp(a, b)).toBe(expected);
  });
});

const defaultHideFrom = { legend: false, viz: false, tooltip: false };

// Builds one frame of numeric fields. Fields default to a visible config; pass config to override.
const makeSeries = (slices: Array<{ name: string; value: number; config?: FieldConfig }>) => [
  toDataFrame({
    fields: slices.map(({ name, value, config }) => ({
      name,
      type: FieldType.number,
      values: [value],
      config: config ?? { custom: { hideFrom: defaultHideFrom } },
    })),
  }),
];

const defaultSliceSeries = makeSeries([
  { name: 'Chrome', value: 60 },
  { name: 'Firefox', value: 40 },
]);

const buildLegend = (overrides: Partial<PieChartLegendOptions> = {}): PieChartLegendOptions => ({
  displayMode: LegendDisplayMode.List,
  showLegend: true,
  placement: 'right',
  calcs: [],
  values: [PieChartLegendValues.Percent],
  ...overrides,
});

const buildOptions = (overrides: Partial<Options> = {}): Options => ({
  pieType: PieChartType.Pie,
  sort: SortOrder.Descending,
  displayLabels: [],
  legend: buildLegend(),
  reduceOptions: { calcs: [] },
  orientation: VizOrientation.Auto,
  tooltip: { mode: TooltipDisplayMode.Multi, sort: SortOrder.Ascending },
  ...overrides,
});

const setup = (propsOverrides?: {}) => {
  const fieldConfig: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  const props: PieChartPanelProps = {
    id: 1,
    data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] },
    timeZone: 'utc',
    options: buildOptions(),
    fieldConfig: fieldConfig,
    width: 532,
    height: 250,
    renderCounter: 0,
    title: 'A pie chart',
    transparent: false,
    onFieldConfigChange: () => {},
    onOptionsChange: () => {},
    onChangeTimeRange: () => {},
    replaceVariables: (s: string) => s,
    eventBus: new EventBusSrv(),
    timeRange: getDefaultTimeRange(),
    ...propsOverrides,
  };

  return render(<PieChartPanel {...props} />);
};
