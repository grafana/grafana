import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

import { createDataFrame, FieldType, type Field } from '@grafana/data/dataframe';
import { getDisplayProcessor } from '@grafana/data/field';
import { createTheme } from '@grafana/data/themes';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode, VisibilityMode } from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { XYChartPanel2 } from './XYChartPanel';
import { type Options, PointShape, SeriesMapping } from './panelcfg.gen';
import { prepConfig } from './scatter';
import { type XYSeries } from './types2';
import { prepSeries } from './utils';

const mockPrepData = jest.fn(() => [
  null,
  [
    [1, 2],
    [10, 20],
    [5, 5],
    ['#ff0000', '#ff0000'],
  ],
]);
const mockBuilder = {};

jest.mock('./scatter', () => ({
  prepConfig: jest.fn(() => ({
    builder: mockBuilder,
    prepData: mockPrepData,
    warn: null,
  })),
}));

jest.mock('./utils', () => ({
  prepSeries: jest.fn(() => []),
}));

const prepConfigMock = prepConfig as jest.Mock;
const prepSeriesMock = prepSeries as jest.Mock;

/*
 * Why mock @grafana/ui components:
 * - UPlotChart needs a real uPlot + canvas (no DOM in Jest)
 * - VizLayout uses a render-prop that needs real dimensions
 * - Stubbing them lets us test what gets rendered and what props are passed
 */
jest.mock('@grafana/ui', () => {
  const actual = jest.requireActual('@grafana/ui');
  return {
    ...actual,
    useStyles2: () => ({ legend: '' }),
    useTheme2: () => actual.createTheme?.() ?? {},
    usePanelContext: () => ({ canExecuteActions: () => false }),
    UPlotChart: ({ children }: { children?: ReactNode }) => <div data-testid="uplot-chart">{children}</div>,
    VizLayout: Object.assign(
      ({ children, legend }: { children: unknown; legend: ReactNode }) => (
        <div data-testid="viz-layout">
          {legend}
          {typeof children === 'function' ? children(100, 100) : children}
        </div>
      ),
      {
        Legend: ({ children }: { children: ReactNode }) => <div data-testid="viz-layout-legend">{children}</div>,
      }
    ),
    VizLegend: (props: { items?: Array<{ label: string; color: string }> }) => (
      <div data-testid="viz-legend">
        {props.items?.map((item, i) => (
          <span key={i} data-testid={`legend-item-${i}`} data-color={item.color}>
            {item.label}
          </span>
        ))}
      </div>
    ),
    TooltipPlugin2: (_props: Record<string, unknown>) => <div data-testid="tooltip-plugin" />,
    TooltipDisplayMode: actual.TooltipDisplayMode,
  };
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  PanelDataErrorView: (props: { message?: string }) => <div data-testid="error-view">{props.message}</div>,
}));

const theme = createTheme();

function makeField(opts: {
  name: string;
  values: number[];
  displayName?: string;
  hideFromLegend?: boolean;
  hideFromViz?: boolean;
}): Field {
  const { name, values, displayName, hideFromLegend = false, hideFromViz = false } = opts;

  const field = createDataFrame({
    fields: [
      {
        name,
        type: FieldType.number,
        values,
        config: {
          custom: {
            hideFrom: { legend: hideFromLegend, viz: hideFromViz },
          },
        },
      },
    ],
  }).fields[0];

  field.display = getDisplayProcessor({ field, theme });

  if (displayName) {
    field.state = { ...field.state, displayName };
  }
  if (hideFromViz) {
    field.state = { ...field.state, hideFrom: { viz: true, legend: false, tooltip: false } };
  }

  return field;
}

function makeSeries(overrides?: Partial<XYSeries>): XYSeries {
  return {
    showPoints: VisibilityMode.Always,
    pointShape: PointShape.Circle,
    pointStrokeWidth: 1,
    fillOpacity: 50,
    showLine: false,
    lineWidth: 1,
    lineStyle: { fill: 'solid' },
    name: { value: 'Series A' },
    x: { field: makeField({ name: 'x', values: [1, 2, 3] }) },
    y: { field: makeField({ name: 'y', values: [10, 20, 30] }) },
    color: { fixed: '#ff0000' },
    size: { fixed: 5 },
    _rest: [],
    ...overrides,
  };
}

const defaultOptions: Options = {
  mapping: SeriesMapping.Auto,
  series: [],
  legend: {
    showLegend: true,
    placement: 'bottom',
    displayMode: LegendDisplayMode.List,
    calcs: [],
  },
  tooltip: {
    mode: TooltipDisplayMode.Single,
    sort: SortOrder.None,
  },
};

function renderPanel(optionOverrides?: Partial<Options>, seriesOverride?: XYSeries[]) {
  prepSeriesMock.mockReturnValue(seriesOverride ?? [makeSeries()]);

  const props = getPanelProps<Options>({ ...defaultOptions, ...optionOverrides });

  return render(<XYChartPanel2 {...props} />);
}

describe('XYChartPanel2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prepConfigMock.mockReturnValue({
      builder: mockBuilder,
      prepData: mockPrepData,
      warn: null,
    });
  });

  it('renders error view when prepConfig returns warn', () => {
    prepConfigMock.mockReturnValue({ builder: null, prepData: () => [], warn: 'No data' });

    renderPanel();
    expect(screen.getByTestId('error-view')).toBeVisible();
    expect(screen.getByText('No data')).toBeVisible();
  });

  it('renders error view when builder is null', () => {
    prepConfigMock.mockReturnValue({ builder: null, prepData: () => [null], warn: null });

    renderPanel();
    expect(screen.getByTestId('error-view')).toBeVisible();
  });

  it('renders UPlotChart when series and config are valid', () => {
    renderPanel();
    expect(screen.getByTestId('uplot-chart')).toBeVisible();
    expect(screen.queryByTestId('error-view')).toBeNull();
  });

  it('does not render tooltip when mode is None', () => {
    renderPanel({ tooltip: { mode: TooltipDisplayMode.None, sort: SortOrder.None } });
    expect(screen.queryByTestId('tooltip-plugin')).toBeNull();
  });

  it('renders tooltip when mode is not None', () => {
    renderPanel({ tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None } });
    expect(screen.getByTestId('tooltip-plugin')).toBeVisible();
  });

  describe('legend', () => {
    it('does not render legend when showLegend is false', () => {
      renderPanel({
        legend: { showLegend: false, placement: 'bottom', displayMode: LegendDisplayMode.List, calcs: [] },
      });
      expect(screen.queryByTestId('viz-legend')).toBeNull();
    });

    it('builds legend items with correct labels', () => {
      const series1 = makeSeries({
        name: { value: 'cpu' },
        color: { fixed: '#ff0000' },
        y: { field: makeField({ name: 'y1', values: [10], displayName: 'cpu usage' }) },
      });
      const series2 = makeSeries({
        name: { value: 'mem' },
        color: { fixed: '#00ff00' },
        y: { field: makeField({ name: 'y2', values: [20], displayName: 'mem usage' }) },
      });

      renderPanel(undefined, [series1, series2]);

      expect(screen.getByText('cpu')).toBeVisible();
      expect(screen.getByText('mem')).toBeVisible();
    });

    it('excludes series with hideFrom.legend true', () => {
      const visibleSeries = makeSeries({
        name: { value: 'visible' },
        y: { field: makeField({ name: 'y1', values: [10] }) },
      });
      const hiddenSeries = makeSeries({
        name: { value: 'hidden' },
        y: { field: makeField({ name: 'y2', values: [20], hideFromLegend: true }) },
      });

      renderPanel(undefined, [visibleSeries, hiddenSeries]);

      expect(screen.getByText('visible')).toBeVisible();
      expect(screen.queryByText('hidden')).toBeNull();
    });
  });
});
