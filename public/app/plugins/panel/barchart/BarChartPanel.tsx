import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type uPlot from 'uplot';

import { type PanelProps, VizOrientation } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelDataErrorView } from '@grafana/runtime';
import { useFlagDashboardBiMode } from '@grafana/runtime/internal';
import {
  type AdHocFilterItem,
  type AdHocFilterModel,
  TooltipDisplayMode,
  TooltipPlugin2,
  UPLOT_AXIS_FONT_SIZE,
  UPlotChart,
  VizLayout,
  measureText,
  usePanelContext,
  useTheme2,
} from '@grafana/ui';
import { FILTER_FOR_OPERATOR, TooltipHoverMode } from '@grafana/ui/internal';
import { getAssistantTooltipContext } from 'app/core/components/AssistantTooltip/buildAssistantContext';

import { TimeSeriesTooltip } from '../timeseries/TimeSeriesTooltip';

import { BarChartLegend, hasVisibleLegendSeries } from './BarChartLegend';
import { type Options } from './panelcfg.gen';
import { applySelectionClick, getSelectedIndices } from './selection';
import { prepConfig, prepSeries } from './utils';

const charWidth = measureText('M', UPLOT_AXIS_FONT_SIZE).width;
const toRads = Math.PI / 180;

export const BarChartPanel = (props: PanelProps<Options>) => {
  const { data, options, fieldConfig, width, height, timeZone, id, replaceVariables } = props;

  // will need this if joining on time to re-create data links
  // const { dataLinkPostProcessor } = usePanelContext();

  const theme = useTheme2();
  const {
    onAddAdHocFilter,
    canExecuteActions,
    onSetAdHocFilterSelection,
    getAdHocFilterSelection,
    subscribeToAdHocFilterSelection,
  } = usePanelContext();
  const isBiMode = useFlagDashboardBiMode();

  const userCanExecuteActions = useMemo(() => canExecuteActions?.() ?? false, [canExecuteActions]);

  const {
    barWidth,
    barRadius = 0,
    showValue,
    groupWidth,
    stacking,
    legend,
    tooltip,
    text,
    xTickLabelRotation,
    xTickLabelSpacing,
    fullHighlight,
    xField,
    colorByField,
  } = options;

  // size-dependent, calculated opts that should cause viz re-config
  let { orientation, xTickLabelMaxLength = 0 } = options;

  orientation =
    orientation === VizOrientation.Auto
      ? width < height
        ? VizOrientation.Horizontal
        : VizOrientation.Vertical
      : orientation;

  // TODO: this can be moved into axis calc internally, no need to re-config based on this
  // should be based on vizHeight, not full height?
  xTickLabelMaxLength =
    xTickLabelRotation === 0
      ? Infinity // should this calc using spacing between groups?
      : xTickLabelMaxLength ||
        // auto max length clamps to half viz height, subracts 3 chars for ... ellipsis
        Math.floor(height / 2 / Math.sin(Math.abs(xTickLabelRotation * toRads)) / charWidth - 3);

  // TODO: config data links
  const info = useMemo(
    () => prepSeries(data.series, fieldConfig, stacking, theme, xField, colorByField),
    [data.series, fieldConfig, stacking, theme, xField, colorByField]
  );

  const vizSeries = useMemo(
    () =>
      info.series.map((frame) => ({
        ...frame,
        fields: frame.fields.filter((field, i) => i === 0 || !field.state?.hideFrom?.viz),
      })),
    [info.series]
  );

  // the prepared category field; selection filters on its values
  const categoryField = vizSeries[0]?.fields[0];
  const selectable =
    isBiMode &&
    categoryField?.config.filterable === true &&
    onSetAdHocFilterSelection != null &&
    getAdHocFilterSelection != null &&
    subscribeToAdHocFilterSelection != null;
  const selectionKey = selectable ? categoryField.name : undefined;

  const categories = useMemo(() => categoryField?.values.map((v) => String(v)) ?? [], [categoryField]);

  // re-read the selection whenever ad hoc filters change
  const [selectionVersion, onSelectionChanged] = useReducer((v: number) => v + 1, 0);
  // the selection the latest click wrote, shown until that write completes; mirrored in a ref so rapid clicks
  // build on it before React re-renders
  const [pendingSelection, setPendingSelectionState] = useState<{ values: string[] } | null>(null);
  const pendingSelectionRef = useRef<{ values: string[] } | null>(null);
  const setPendingSelection = (pending: { values: string[] } | null) => {
    pendingSelectionRef.current = pending;
    setPendingSelectionState(pending);
  };
  // writes run one after another, so the filter ends up as the latest click left it
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  // identifies the latest write, so only its completion clears the pending selection
  const writeSeqRef = useRef(0);
  // bumped on unmount, so queued writes from an unmounted panel neither start nor update state
  const lifecycleRef = useRef({ generation: 0 });

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    return () => {
      lifecycle.generation++;
    };
  }, []);

  useEffect(() => {
    if (!selectable) {
      return;
    }

    return subscribeToAdHocFilterSelection(onSelectionChanged);
  }, [selectable, subscribeToAdHocFilterSelection]);

  const ownedSelection = useMemo(
    () => (selectionKey == null ? undefined : getAdHocFilterSelection?.(selectionKey)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectionKey, getAdHocFilterSelection, selectionVersion]
  );
  const currentSelection = selectionKey == null ? undefined : (pendingSelection?.values ?? ownedSelection);

  const selectedIndices = useMemo(
    () => getSelectedIndices(categories, currentSelection),
    [categories, currentSelection]
  );

  // read by the bars draw hook, so a selection change needs only a redraw, not a new config
  const selectedIndicesRef = useRef<Set<number> | null>(null);
  selectedIndicesRef.current = selectedIndices;
  const getSelection = useCallback(() => selectedIndicesRef.current, []);

  const plotRef = useRef<uPlot | null>(null);
  const setPlot = useCallback((u: uPlot) => {
    plotRef.current = u;
  }, []);

  useEffect(() => {
    plotRef.current?.redraw(false);
  }, [selectedIndices]);

  // Shift-click anchor; a category value, dropped when it leaves the data or this panel loses its selection
  // (another panel takes over, the pill is removed, or a plain click clears it)
  const anchorRef = useRef<string | null>(null);

  useEffect(() => {
    if (anchorRef.current == null) {
      return;
    }

    if (!categories.includes(anchorRef.current) || (ownedSelection === undefined && pendingSelection == null)) {
      anchorRef.current = null;
    }
  }, [categories, ownedSelection, pendingSelection]);

  const onSelect = (dataIdx: number, meta: boolean, shift: boolean) => {
    if (selectionKey == null || onSetAdHocFilterSelection == null) {
      return;
    }

    const clicked = categories[dataIdx];

    if (clicked == null) {
      return;
    }

    const next = applySelectionClick({
      categories,
      // the latest intended selection: a queued write's, else what the filter holds now
      current: pendingSelectionRef.current?.values ?? getAdHocFilterSelection?.(selectionKey),
      anchor: anchorRef.current,
      clicked,
      meta,
      shift,
    });

    anchorRef.current = next.anchor;
    setPendingSelection({ values: next.values });
    const seq = ++writeSeqRef.current;
    const generation = lifecycleRef.current.generation;
    const isLive = () => generation === lifecycleRef.current.generation;

    const update = { key: selectionKey, values: next.values, clickedValue: clicked, mode: next.mode };

    writeQueueRef.current = writeQueueRef.current
      .then(() => (isLive() ? onSetAdHocFilterSelection(update) : undefined))
      .catch(() => {})
      .finally(() => {
        if (!isLive()) {
          return;
        }

        if (seq === writeSeqRef.current) {
          setPendingSelection(null);
        }
        onSelectionChanged();
      });
  };

  const xGroupsCount = vizSeries[0]?.length ?? 0;
  const seriesCount = vizSeries[0]?.fields.length ?? 0;
  const totalSeries = Math.max(0, (info.series[0]?.fields.length ?? 0) - 1);

  let { builder, prepData } = useMemo(
    () => {
      return xGroupsCount === 0
        ? { builder: null, prepData: null }
        : prepConfig({
            series: vizSeries,
            totalSeries,
            color: info.color,
            orientation,
            options,
            timeZone,
            theme,
            // only selectable panels pay for the veil
            getSelection: selectable ? getSelection : undefined,
          });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      orientation,
      timeZone,
      props.data.structureRev,

      totalSeries,
      seriesCount,
      xGroupsCount,

      barWidth,
      barRadius,
      showValue,
      groupWidth,
      stacking,
      legend,
      tooltip,
      text?.valueSize, // cause text obj is re-created each time?
      xTickLabelRotation,
      xTickLabelSpacing,
      fullHighlight,
      xField,
      colorByField,
      xTickLabelMaxLength, // maybe not?
      selectable,
      // props.fieldConfig, // usePrevious hideFrom on all fields?
    ]
  );

  const plotData = useMemo(
    () => (prepData == null ? [] : prepData(vizSeries, info.color)),
    [prepData, vizSeries, info.color]
  );

  if (info.warn != null || builder == null) {
    return (
      <PanelDataErrorView
        panelId={id}
        fieldConfig={fieldConfig}
        data={data}
        message={info.warn ?? ''}
        needsNumberField={true}
      />
    );
  }

  const getDataLinks = (seriesIdx: number, dataIdx: number) =>
    vizSeries[0].fields[seriesIdx].getLinks?.({ valueRowIndex: dataIdx }) ?? [];

  const legendComp =
    legend.showLegend && hasVisibleLegendSeries(builder, info.series!) ? (
      <BarChartLegend data={info.series!} colorField={info.color} {...legend} />
    ) : null;

  return (
    <VizLayout
      width={props.width}
      height={props.height}
      // legend={<BarChartLegend frame={info.series![0]} colorField={info.color} {...legend} />}
      legend={legendComp}
    >
      {(vizWidth, vizHeight) => (
        <UPlotChart config={builder!} data={plotData} width={vizWidth} height={vizHeight} plotRef={setPlot}>
          {selectable && props.options.tooltip.mode === TooltipDisplayMode.None && (
            // no visible tooltip, but clicks still select
            <TooltipPlugin2
              config={builder}
              hoverMode={TooltipHoverMode.xOne}
              clickMode="select"
              selectPinnable={false}
              getDataLinks={getDataLinks}
              onSelect={(_seriesIdx, dataIdx, { meta, shift }) => onSelect(dataIdx, meta, shift)}
              render={() => null}
            />
          )}
          {props.options.tooltip.mode !== TooltipDisplayMode.None && (
            <TooltipPlugin2
              config={builder}
              clickMode={selectable ? 'select' : 'pin'}
              onSelect={(_seriesIdx, dataIdx, { meta, shift }) => onSelect(dataIdx, meta, shift)}
              selectHint={selectable ? t('bar-chart.tooltip.select-hint', 'Alt-click to pin') : undefined}
              maxWidth={options.tooltip.maxWidth}
              hoverMode={
                options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
              }
              getDataLinks={getDataLinks}
              getAdHocFilters={(_seriesIdx, dataIdx) => {
                const xField = vizSeries[0].fields[0];

                // Check if the field supports filtering
                // We only show filters on filterable fields (xField.config.filterable).
                // Fields will have been marked as filterable by the data source if that data source supports adhoc filtering
                // (eg. Prom or Loki) and the field types support adhoc filtering (eg. string or number - depending on the data source).
                // Fields may later be marked as not filterable. For example, fields created from Grafana Transforms that
                // are derived from a data source, but are not present in the data source.
                // We choose `xField` here because it contains the label-value pair, rather than `field` which is the numeric Value.
                if (xField.config.filterable && onAddAdHocFilter != null) {
                  const adHocFilterItem: AdHocFilterItem = {
                    key: xField.name,
                    operator: FILTER_FOR_OPERATOR,
                    value: String(xField.values[dataIdx]),
                  };

                  const adHocFilters: AdHocFilterModel[] = [
                    {
                      ...adHocFilterItem,
                      onClick: () => onAddAdHocFilter(adHocFilterItem),
                    },
                  ];

                  return adHocFilters;
                }

                return [];
              }}
              render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2, viaSync, dataLinks, adHocFilters) => {
                return (
                  <TimeSeriesTooltip
                    series={vizSeries[0]}
                    _rest={info._rest}
                    dataIdxs={dataIdxs}
                    seriesIdx={seriesIdx}
                    mode={options.tooltip.mode}
                    sortOrder={options.tooltip.sort}
                    isPinned={isPinned}
                    maxHeight={options.tooltip.maxHeight}
                    replaceVariables={replaceVariables}
                    dataLinks={dataLinks}
                    adHocFilters={adHocFilters}
                    hideZeros={options.tooltip.hideZeros}
                    canExecuteActions={userCanExecuteActions}
                    assistantContext={getAssistantTooltipContext(props, info.series)}
                  />
                );
              }}
            />
          )}
        </UPlotChart>
      )}
    </VizLayout>
  );
};
