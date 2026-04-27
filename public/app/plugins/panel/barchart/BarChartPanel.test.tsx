import { render, screen } from '@testing-library/react';
import React from 'react';

import { ActionType, type FieldConfigSource, getDefaultTimeRange, getLinksSupplier, HttpRequestMethod, LoadingState } from '@grafana/data';
import { createDataFrame, type DataFrame, FieldType } from '@grafana/data/dataframe';
import { selectors } from '@grafana/e2e-selectors';
import {
  LegendDisplayMode,
  SortOrder,
  StackingMode,
  TooltipDisplayMode,
  VisibilityMode,
  VizOrientation,
} from '@grafana/schema';

import { getPanelProps } from '../test-utils';

import { BarChartPanel } from './BarChartPanel';
import { defaultOptions, type Options } from './panelcfg.gen';
import { applyBarChartFieldDefaults } from './test-helpers';

let canExecuteActionsForTest = false;
let onAddAdHocFilterMock: jest.Mock;

jest.mock('@grafana/ui', () => {
  return {
    ...jest.requireActual('@grafana/ui'),
    usePanelContext: jest.fn().mockImplementation(() => ({
      canExecuteActions: () => canExecuteActionsForTest,
      onAddAdHocFilter: onAddAdHocFilterMock,
    })),
    TooltipPlugin2: (props: {
      getDataLinks?: (seriesIdx: number, dataIdx: number) => [];
      getAdHocFilters?: (seriesIdx: number, dataIdx: number) => [];
      render?: (
        u: unknown,
        dataIdxs: Array<number | null>,
        seriesIdx: number | null,
        isPinned?: boolean,
        dismiss?: () => void,
        timeRange2?: unknown,
        viaSync?: boolean,
        dataLinks?: unknown[],
        adHocFilters?: unknown[]
      ) => React.ReactNode;
    }) => {
      const dataIdxs: Array<number | null> = [0, 0];
      const seriesIdx = 1;
      const dataLinks = props.getDataLinks?.(seriesIdx, 0) ?? [];
      const adHocFilters = props.getAdHocFilters?.(seriesIdx, 0) ?? [];
      const content = props.render?.({}, dataIdxs, seriesIdx, true, jest.fn(), null, false, dataLinks, adHocFilters);
      return <div data-testid="barchart-tooltip-plugin">{content}</div>;
    },
  };
});

const defaultPanelOptions: Options = {
  ...defaultOptions,
  barWidth: 0.97,
  fullHighlight: false,
  groupWidth: 0.7,
  orientation: VizOrientation.Auto,
  showValue: VisibilityMode.Auto,
  stacking: StackingMode.None,
  xTickLabelMaxLength: 0,
  xTickLabelRotation: 0,
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
  text: {
    valueSize: 80,
  },
};

const baseLegend = defaultPanelOptions.legend ?? {
  showLegend: true,
  displayMode: LegendDisplayMode.List,
  placement: 'bottom',
  calcs: [],
};

describe('BarChartPanel', () => {
  beforeEach(() => {
    canExecuteActionsForTest = false;
    onAddAdHocFilterMock = jest.fn();
  });

  const defaultFieldConfig: FieldConfigSource = {
    defaults: { custom: {} },
    overrides: [],
  };

  /**
   * Renders BarChartPanel with the given data and options.
   */
  function renderBarChartPanel(
    dataOverrides?: Partial<{ series: DataFrame[] }>,
    optionsOverrides?: Partial<Options>,
    panelPropsOverrides?: Partial<{ replaceVariables: (v: string) => string }>
  ) {
    const mergedOptions = { ...defaultPanelOptions, ...optionsOverrides };
    const props = getPanelProps<Options>(mergedOptions, {
      data: {
        state: LoadingState.Done,
        series: [createBarChartPanelFrame()],
        timeRange: getDefaultTimeRange(),
        ...dataOverrides,
      },
      fieldConfig: defaultFieldConfig,
      ...panelPropsOverrides,
    });
    return render(<BarChartPanel {...props} />);
  }

  describe('Happy path', () => {
    it('renders VizLayout when data is valid', () => {
      renderBarChartPanel();

      expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
    });

    it('renders with custom frame', () => {
      const customFrame = createBarChartPanelFrame({
        xValues: ['X', 'Y', 'Z'],
        values: [5, 15, 25],
      });

      renderBarChartPanel({ series: [customFrame] });

      expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeVisible();
    });
  });

  describe('Error states', () => {
    it('shows error view when series is empty', () => {
      renderBarChartPanel({ series: [] });

      expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
      expect(screen.getByText(/Unable to render data/)).toBeVisible();
    });

    it('shows error view when frame has no numeric fields', () => {
      const frameWithNoNumeric = createDataFrame({
        fields: [
          {
            name: 'x',
            type: FieldType.string,
            values: ['a', 'b', 'c'],
            config: { custom: {} },
          },
        ],
      });

      renderBarChartPanel({ series: [frameWithNoNumeric] });

      expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
      expect(screen.getByText(/No numeric fields found/i)).toBeVisible();
    });

    it('shows error view when frame has no string or time field', () => {
      const frameWithNoX = createDataFrame({
        fields: [
          {
            name: 'value',
            type: FieldType.number,
            values: [10, 20, 30],
            config: { unit: 'short', custom: {} },
          },
        ],
      });

      renderBarChartPanel({ series: [frameWithNoX] });

      expect(screen.queryByTestId(selectors.components.VizLayout.container)).not.toBeInTheDocument();
      expect(screen.getByText(/Bar charts require a string or time field/i)).toBeVisible();
    });
  });

  describe('Tooltip', () => {
    it('renders TooltipPlugin2 when tooltip mode is not None', () => {
      renderBarChartPanel(undefined, {
        legend: { ...baseLegend, showLegend: false },
        tooltip: {
          mode: TooltipDisplayMode.Single,
          sort: SortOrder.None,
          maxWidth: 300,
          maxHeight: 300,
          hideZeros: false,
        },
      });

      expect(screen.getByTestId('barchart-tooltip-plugin')).toBeVisible();
    });

    it('does not render TooltipPlugin2 when tooltip mode is None', () => {
      renderBarChartPanel(undefined, {
        legend: { ...baseLegend, showLegend: false },
        tooltip: {
          mode: TooltipDisplayMode.None,
          sort: SortOrder.None,
          maxWidth: 300,
          maxHeight: 300,
          hideZeros: false,
        },
      });

      expect(screen.queryByTestId('barchart-tooltip-plugin')).not.toBeInTheDocument();
    });

    it('renders TimeSeriesTooltip content with x label and value', () => {
      renderBarChartPanel(undefined, {
        legend: { ...baseLegend, showLegend: false },
      });

      expect(screen.getByTestId(selectors.components.Panels.Visualization.Tooltip.Wrapper)).toBeVisible();
      expect(screen.getByText('a')).toBeVisible();
      expect(screen.getByText('10')).toBeVisible();
    });
  });

  describe('Legend', () => {
    it('displays legend when legend.showLegend is true and has visible series', () => {
      renderBarChartPanel();

      expect(screen.getByTestId(selectors.components.VizLayout.legend)).toBeVisible();
      expect(screen.getByTestId(selectors.components.VizLegend.seriesName('value'))).toBeVisible();
    });

    it('hides legend when legend.showLegend is false', () => {
      renderBarChartPanel(undefined, {
        legend: {
          showLegend: false,
          displayMode: LegendDisplayMode.List,
          placement: 'bottom',
          calcs: [],
        },
      });

      expect(screen.queryByTestId(selectors.components.VizLayout.legend)).not.toBeInTheDocument();
    });
  });

  describe('DataLinks', () => {
    it('shows DataLinks in tooltip when links are defined on the field', () => {
      const linkTitle = 'View in Explorer';
      const linkUrl = 'https://example.com';
      const frameWithLinks = createBarChartPanelFrameWithLinks({
        url: linkUrl,
        title: linkTitle,
      });

      renderBarChartPanel({ series: [frameWithLinks] }, { legend: { ...baseLegend, showLegend: false } });

      expect(screen.getByText(linkTitle)).toBeVisible();
      expect(screen.getByRole('link', { name: linkTitle })).toHaveAttribute('href', linkUrl);
    });
  });

  describe('AdHocFilters', () => {
    it('shows ad-hoc filter UI when xField is filterable and onAddAdHocFilter is provided', () => {
      const frameWithFilterableX = createBarChartPanelFrameWithFilterableX();

      renderBarChartPanel({ series: [frameWithFilterableX] }, { legend: { ...baseLegend, showLegend: false } });

      expect(screen.getByText(/Filter for/i)).toBeVisible();
    });
  });

  describe('FieldActions', () => {
    it('shows field actions in tooltip when actions are defined on the field', () => {
      const actionTitle = 'Run query';
      const actionUrl = 'https://api.example.com/run';
      const frameWithActions = createBarChartPanelFrameWithActions({
        title: actionTitle,
        url: actionUrl,
      });

      canExecuteActionsForTest = true;
      renderBarChartPanel(
        { series: [frameWithActions] },
        { legend: { ...baseLegend, showLegend: false } },
        { replaceVariables: (v) => v }
      );

      expect(screen.getByRole('button', { name: actionTitle })).toBeVisible();
    });
  });
});

/**
 * Creates a minimal DataFrame for BarChartPanel tests.
 * Structure: x (string) + value (number). Passes prepSeries validation.
 *
 * @param overrides - Optional overrides for x values and value array
 * @returns DataFrame ready for BarChartPanel data.series
 */
function createBarChartPanelFrame(overrides?: { xValues?: string[]; values?: number[] }): DataFrame {
  const xValues = overrides?.xValues ?? ['a', 'b', 'c'];
  const values = overrides?.values ?? [10, 20, 30];

  const frame = createDataFrame({
    fields: [
      {
        name: 'x',
        type: FieldType.string,
        values: xValues,
        config: { custom: {} },
      },
      {
        name: 'value',
        type: FieldType.number,
        values,
        config: { unit: 'short', custom: {} },
      },
    ],
  });
  applyBarChartFieldDefaults(frame);
  return frame;
}

/**
 * Creates a BarChartPanel frame with DataLinks on the value field.
 * Used for tests that verify link rendering in the tooltip footer.
 * Uses getLinksSupplier so getLinks returns proper LinkModels.
 *
 * @param linkConfig - Link config (url, title) for the value field
 */
function createBarChartPanelFrameWithLinks(linkConfig: { url: string; title: string }): DataFrame {
  const frame = createBarChartPanelFrame();
  const valueField = frame.fields[1];
  valueField.config = {
    ...valueField.config,
    links: [{ url: linkConfig.url, title: linkConfig.title }],
  };
  valueField.getLinks = getLinksSupplier(frame, valueField, {}, (v) => v);
  return frame;
}

/**
 * Creates a BarChartPanel frame with filterable x field for ad-hoc filter tests.
 * Requires onAddAdHocFilter from usePanelContext to show filter UI.
 */
function createBarChartPanelFrameWithFilterableX(): DataFrame {
  const frame = createBarChartPanelFrame();
  const xField = frame.fields[0];
  xField.config = {
    ...xField.config,
    filterable: true,
  };
  return frame;
}

/**
 * Creates a BarChartPanel frame with field actions on the value field.
 * Requires canExecuteActions=true and field.state.scopedVars for actions to render.
 *
 * @param actionConfig - Action config (title, url) for the value field
 */
function createBarChartPanelFrameWithActions(actionConfig: { title: string; url: string }): DataFrame {
  const frame = createBarChartPanelFrame();
  const valueField = frame.fields[1];
  valueField.config = {
    ...valueField.config,
    actions: [
      {
        type: ActionType.Fetch,
        title: actionConfig.title,
        [ActionType.Fetch]: {
          url: actionConfig.url,
          method: HttpRequestMethod.POST,
          body: '{}',
          queryParams: [],
          headers: [['Content-Type', 'application/json']],
        },
      },
    ],
  };
  valueField.state = { scopedVars: {} };
  return frame;
}
