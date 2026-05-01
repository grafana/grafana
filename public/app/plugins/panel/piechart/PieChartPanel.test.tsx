import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ComponentProps } from 'react';

import {
  type FieldConfigSource,
  type FieldDisplay,
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
import { type Options, PieChartType, PieChartLegendValues } from './panelcfg.gen';

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
        expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
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

        trigger.focus();
        await user.keyboard('{Enter}');

        expect(screen.getByText('Open dashboard')).toBeInTheDocument();
        expect(screen.getByText('Open runbook')).toBeInTheDocument();
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

const setup = (propsOverrides?: {}) => {
  const fieldConfig: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  const options: Options = {
    pieType: PieChartType.Pie,
    sort: SortOrder.Descending,
    displayLabels: [],
    legend: {
      displayMode: LegendDisplayMode.List,
      showLegend: true,
      placement: 'right',
      calcs: [],
      values: [PieChartLegendValues.Percent],
    },
    reduceOptions: {
      calcs: [],
    },
    orientation: VizOrientation.Auto,
    tooltip: { mode: TooltipDisplayMode.Multi, sort: SortOrder.Ascending },
  };

  const props: PieChartPanelProps = {
    id: 1,
    data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] },
    timeZone: 'utc',
    options: options,
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
