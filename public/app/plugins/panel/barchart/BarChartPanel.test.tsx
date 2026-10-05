import React from 'react';
import { act, render, screen } from 'test/test-utils';

import {
  ActionType,
  createDataFrame,
  type DataFrame,
  type FieldConfigSource,
  FieldType,
  getDefaultTimeRange,
  getLinksSupplier,
  HttpRequestMethod,
  LoadingState,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  LegendDisplayMode,
  SortOrder,
  StackingMode,
  TooltipDisplayMode,
  VisibilityMode,
  VizOrientation,
} from '@grafana/schema';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { type AdHocFilterSelectionUpdate } from '@grafana/ui';

import { getPanelProps } from '../test-utils';

import { BarChartPanel } from './BarChartPanel';
import { defaultOptions, type Options } from './panelcfg.gen';
import { applyBarChartFieldDefaults } from './test-helpers';
import { prepConfig } from './utils';

let canExecuteActionsForTest = false;
let onAddAdHocFilterMock: jest.Mock;
let selectionContextForTest: Record<string, unknown> = {};

interface MockTooltipProps {
  clickMode?: 'pin' | 'select';
  onSelect?: (seriesIdx: number, dataIdx: number, modifiers: { meta: boolean; shift: boolean }) => void;
  selectHint?: React.ReactNode;
  selectPinnable?: boolean;
  getDataLinks?: (seriesIdx: number, dataIdx: number) => unknown[];
  // method syntax so the mock's typed render is assignable
  render?(...args: never[]): React.ReactNode;
}
let tooltipPropsForTest: MockTooltipProps[] = [];
// re-rendering the real tooltip contents logs an unrelated React.Fragment ref warning, so selection tests skip them
let renderTooltipContentForTest = true;

jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils');
  return { ...actual, prepConfig: jest.fn(actual.prepConfig) };
});

jest.mock('@grafana/ui', () => {
  return {
    ...jest.requireActual('@grafana/ui'),
    usePanelContext: jest.fn().mockImplementation(() => ({
      canExecuteActions: () => canExecuteActionsForTest,
      onAddAdHocFilter: onAddAdHocFilterMock,
      ...selectionContextForTest,
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
      tooltipPropsForTest.push(props);
      const dataIdxs: Array<number | null> = [0, 0];
      const seriesIdx = 1;
      const dataLinks = props.getDataLinks?.(seriesIdx, 0) ?? [];
      const adHocFilters = props.getAdHocFilters?.(seriesIdx, 0) ?? [];
      const content =
        renderTooltipContentForTest &&
        props.render?.({}, dataIdxs, seriesIdx, true, jest.fn(), null, false, dataLinks, adHocFilters);
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
    selectionContextForTest = {};
    tooltipPropsForTest = [];
    renderTooltipContentForTest = true;
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

  describe('BI selection', () => {
    /** A fake selection store standing in for the dashboard's ad hoc filter variable */
    function setUpSelectionContext(initial?: string[]) {
      let owned = initial;
      const listeners = new Set<() => void>();
      const apply = (update: AdHocFilterSelectionUpdate) => {
        owned = update.values.length > 0 ? update.values : undefined;
        listeners.forEach((l) => l());
      };
      const onSetAdHocFilterSelection = jest.fn(async (update: AdHocFilterSelectionUpdate) => apply(update));

      selectionContextForTest = {
        onSetAdHocFilterSelection,
        getAdHocFilterSelection: jest.fn(() => owned),
        subscribeToAdHocFilterSelection: jest.fn((onChange: () => void) => {
          listeners.add(onChange);
          return () => listeners.delete(onChange);
        }),
      };

      return {
        onSetAdHocFilterSelection,
        listeners,
        apply,
        getOwned: () => owned,
        setOwned: (values: string[] | undefined) => {
          owned = values;
          listeners.forEach((l) => l());
        },
      };
    }

    const lastTooltip = () => tooltipPropsForTest.at(-1)!;
    const getSelection = () => jest.mocked(prepConfig).mock.calls.at(-1)![0].getSelection!();

    const clickBar = async (dataIdx: number, modifiers = { meta: false, shift: false }) => {
      await act(async () => {
        lastTooltip().onSelect!(1, dataIdx, modifiers);
      });
    };

    const renderSelectable = (optionsOverrides?: Partial<Options>) =>
      renderBarChartPanel(
        { series: [createBarChartPanelFrameWithFilterableX()] },
        { legend: { ...baseLegend, showLegend: false }, ...optionsOverrides }
      );

    beforeEach(() => {
      setTestFlags({ 'dashboard.biMode': true });
      jest.mocked(prepConfig).mockClear();
      renderTooltipContentForTest = false;
    });

    afterEach(() => {
      act(() => setTestFlags({}));
    });

    it('uses select mode with the Alt-click hint', () => {
      setUpSelectionContext();
      renderSelectable();

      expect(lastTooltip().clickMode).toBe('select');
      expect(lastTooltip().selectHint).toBe('Alt-click to pin');
    });

    it('writes a replace selection for the clicked category', async () => {
      const { onSetAdHocFilterSelection } = setUpSelectionContext();
      renderSelectable();

      await clickBar(1);

      expect(onSetAdHocFilterSelection).toHaveBeenCalledWith({
        key: 'x',
        values: ['b'],
        clickedValue: 'b',
        mode: 'replace',
      });
      expect(getSelection()).toEqual(new Set([1]));
    });

    it('clears when the sole selected bar is clicked, without rebuilding the config', async () => {
      const { onSetAdHocFilterSelection } = setUpSelectionContext(['a']);
      renderSelectable();

      expect(getSelection()).toEqual(new Set([0]));
      const configBuilds = jest.mocked(prepConfig).mock.calls.length;

      await clickBar(0);

      expect(onSetAdHocFilterSelection).toHaveBeenCalledWith(expect.objectContaining({ values: [], mode: 'replace' }));
      expect(getSelection()).toBeNull();
      expect(jest.mocked(prepConfig).mock.calls.length).toBe(configBuilds);
    });

    it('adds a Shift range from the anchor and toggles with Ctrl/Cmd', async () => {
      const { onSetAdHocFilterSelection } = setUpSelectionContext();
      renderSelectable();

      await clickBar(0);
      await clickBar(2, { meta: false, shift: true });

      expect(onSetAdHocFilterSelection).toHaveBeenLastCalledWith(
        expect.objectContaining({ values: ['a', 'b', 'c'], clickedValue: 'c', mode: 'range' })
      );

      await clickBar(1, { meta: true, shift: false });

      expect(onSetAdHocFilterSelection).toHaveBeenLastCalledWith(
        expect.objectContaining({ values: ['a', 'c'], clickedValue: 'b', mode: 'toggle' })
      );
      expect(getSelection()).toEqual(new Set([0, 2]));
    });

    it('takes ownership with the clicked value when another panel owns the selection', async () => {
      // the context reports no selection for this panel even though a filter exists
      const { onSetAdHocFilterSelection } = setUpSelectionContext(undefined);
      renderSelectable();

      await clickBar(0);

      expect(onSetAdHocFilterSelection).toHaveBeenCalledWith(expect.objectContaining({ values: ['a'] }));
    });

    it('re-reads the selection when filters change elsewhere', async () => {
      const { setOwned } = setUpSelectionContext(['a']);
      renderSelectable();

      act(() => setOwned(['b', 'c']));

      expect(getSelection()).toEqual(new Set([1, 2]));
    });

    it('unsubscribes on unmount', () => {
      const { listeners } = setUpSelectionContext();
      const view = renderSelectable();

      expect(listeners.size).toBe(1);
      view.unmount();
      expect(listeners.size).toBe(0);
    });

    it('still mounts a select-mode tooltip plugin that renders nothing when the tooltip is hidden', () => {
      setUpSelectionContext();
      renderSelectable({ tooltip: { ...defaultPanelOptions.tooltip, mode: TooltipDisplayMode.None } });

      expect(tooltipPropsForTest).not.toHaveLength(0);
      expect(lastTooltip().clickMode).toBe('select');
      expect(lastTooltip().render!()).toBeNull();
      // nothing to pin, but one-click links still win
      expect(lastTooltip().selectPinnable).toBe(false);
      expect(lastTooltip().getDataLinks).toBeDefined();
    });

    it('drops the Shift anchor when another panel takes over the selection', async () => {
      const { onSetAdHocFilterSelection, setOwned } = setUpSelectionContext();
      renderSelectable();

      await clickBar(0);
      act(() => setOwned(undefined));
      await clickBar(2, { meta: false, shift: true });

      expect(onSetAdHocFilterSelection).toHaveBeenLastCalledWith(
        expect.objectContaining({ values: ['c'], mode: 'range' })
      );
    });

    it('publishes writes in click order even when the earlier write is slower', async () => {
      const { onSetAdHocFilterSelection, apply, getOwned } = setUpSelectionContext();
      let releaseFirst: () => void = () => {};
      // the first write is slow; any later one would finish at once, overtaking it if both ran together
      onSetAdHocFilterSelection
        .mockImplementationOnce(
          (update) =>
            new Promise<void>((resolve) => {
              releaseFirst = () => {
                apply(update);
                resolve();
              };
            })
        )
        .mockImplementation(async (update) => apply(update));
      renderSelectable();

      await clickBar(0);
      await clickBar(1, { meta: true, shift: false });

      // the second write waits for the first; the pending selection already shows the latest click
      expect(onSetAdHocFilterSelection).toHaveBeenCalledTimes(1);
      expect(getSelection()).toEqual(new Set([0, 1]));

      await act(async () => releaseFirst());

      expect(onSetAdHocFilterSelection).toHaveBeenCalledTimes(2);
      expect(onSetAdHocFilterSelection).toHaveBeenLastCalledWith(
        expect.objectContaining({ values: ['a', 'b'], mode: 'toggle' })
      );
      expect(getOwned()).toEqual(['a', 'b']);
      expect(getSelection()).toEqual(new Set([0, 1]));
    });

    it('keeps the newest pending selection while an earlier write is in flight', async () => {
      const { onSetAdHocFilterSelection } = setUpSelectionContext();
      const resolvers: Array<() => void> = [];
      onSetAdHocFilterSelection.mockImplementation(() => new Promise<void>((resolve) => resolvers.push(resolve)));
      renderSelectable();

      await clickBar(0);
      await clickBar(1, { meta: true, shift: false });

      // the first write completes without publishing; the newer pending selection must stay
      await act(async () => resolvers[0]());
      expect(getSelection()).toEqual(new Set([0, 1]));

      await act(async () => resolvers[1]());
      expect(getSelection()).toBeNull();
    });

    it('never starts a queued write after the panel unmounts', async () => {
      const { onSetAdHocFilterSelection } = setUpSelectionContext();
      let releaseFirst: () => void = () => {};
      onSetAdHocFilterSelection.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve;
          })
      );
      const view = renderSelectable();

      await clickBar(0);
      await clickBar(1, { meta: true, shift: false });
      expect(onSetAdHocFilterSelection).toHaveBeenCalledTimes(1);

      view.unmount();
      await act(async () => releaseFirst());

      expect(onSetAdHocFilterSelection).toHaveBeenCalledTimes(1);
    });

    it('applies a later write after an earlier one fails', async () => {
      const { onSetAdHocFilterSelection, getOwned } = setUpSelectionContext();
      onSetAdHocFilterSelection.mockRejectedValueOnce(new Error('write failed'));
      renderSelectable();

      await clickBar(0);
      await clickBar(2);

      expect(onSetAdHocFilterSelection).toHaveBeenCalledTimes(2);
      expect(getOwned()).toEqual(['c']);
      expect(getSelection()).toEqual(new Set([2]));
    });

    it('gives the bars no selection getter when not selectable', () => {
      act(() => setTestFlags({ 'dashboard.biMode': false }));
      setUpSelectionContext();
      renderSelectable();

      expect(jest.mocked(prepConfig).mock.calls.at(-1)![0].getSelection).toBeUndefined();
    });

    it('keeps pin mode when the category field is not filterable', () => {
      setUpSelectionContext();
      renderBarChartPanel(undefined, { legend: { ...baseLegend, showLegend: false } });

      expect(lastTooltip().clickMode).toBe('pin');
      expect(lastTooltip().selectHint).toBeUndefined();
    });

    it('keeps pin mode when the toggle is off', () => {
      act(() => setTestFlags({ 'dashboard.biMode': false }));
      setUpSelectionContext();
      renderSelectable();

      expect(lastTooltip().clickMode).toBe('pin');
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
