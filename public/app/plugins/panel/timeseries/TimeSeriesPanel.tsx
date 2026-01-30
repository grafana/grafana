import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  CoreApp,
  PanelProps,
  DataFrameType,
  DashboardCursorSync,
  DataFrame,
  alignTimeRangeCompareData,
  shouldAlignTimeCompare,
  useDataLinksContext,
  FieldType,
  SelectableValue,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { LegendDisplayMode, TooltipDisplayMode, VizOrientation } from '@grafana/schema';
import {
  EventBusPlugin,
  IconButton,
  KeyboardPlugin,
  Popover,
  Select,
  Stack,
  Text,
  TooltipPlugin2,
  XAxisInteractionAreaPlugin,
  usePanelContext,
  useTheme2,
} from '@grafana/ui';
import { FILTER_OUT_OPERATOR, TimeRange2, TooltipHoverMode } from '@grafana/ui/internal';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';

import { TimeSeriesTooltip } from './TimeSeriesTooltip';
import { Options } from './panelcfg.gen';
import { AnnotationsPlugin2 } from './plugins/AnnotationsPlugin2';
import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
import { OutsideRangePlugin } from './plugins/OutsideRangePlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { getXAnnotationFrames } from './plugins/utils';
import { getPrepareTimeseriesSuggestion } from './suggestions';
import { getGroupedFilters, getTimezones, prepareGraphableFields } from './utils';

interface TimeSeriesPanelProps extends PanelProps<Options> {}

// PoC: this flag is injected by Scenes dashboard via `setDashboardPanelContext`.
// It should become a real `PanelContext` field if we turn this into a feature.
interface PanelContextWithDashboardEditing {
  isDashboardEditing?: boolean;
}

function hasScenesDashboardEditingFlag(v: unknown): v is PanelContextWithDashboardEditing {
  return typeof v === 'object' && v !== null && 'isDashboardEditing' in v;
}

export const TimeSeriesPanel = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
  id,
  title,
  onOptionsChange,
}: TimeSeriesPanelProps) => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const panelContext = usePanelContext();
  const isDashboardEditing = hasScenesDashboardEditingFlag(panelContext)
    ? Boolean(panelContext.isDashboardEditing)
    : false;
  const isEditing = panelContext.app === CoreApp.PanelEditor || isDashboardEditing;

  const {
    sync,
    eventsScope,
    canAddAnnotations,
    onThresholdsChange,
    canEditThresholds,
    showThresholds,
    eventBus,
    canExecuteActions,
    getFiltersBasedOnGrouping,
    onAddAdHocFilters,
  } = panelContext;

  const { dataLinkPostProcessor } = useDataLinksContext();

  const userCanExecuteActions = useMemo(() => canExecuteActions?.() ?? false, [canExecuteActions]);
  // Vertical orientation is not available for users through config.
  // It is simplified version of horizontal time series panel and it does not support all plugins.
  const isVerticallyOriented = options.orientation === VizOrientation.Vertical;
  const { frames, compareDiffMs } = useMemo(() => {
    let frames = prepareGraphableFields(data.series, config.theme2, timeRange);
    if (frames != null) {
      let compareDiffMs: number[] = [0];

      frames.forEach((frame: DataFrame) => {
        const diffMs = frame.meta?.timeCompare?.diffMs ?? 0;

        frame.fields.forEach((field) => {
          if (field.type !== FieldType.time) {
            compareDiffMs.push(diffMs);
          }
        });

        if (diffMs !== 0) {
          // Check if the compared frame needs time alignment
          // Apply alignment when time ranges match (no shift applied yet)
          const needsAlignment = shouldAlignTimeCompare(frame, frames, timeRange);

          if (needsAlignment) {
            alignTimeRangeCompareData(frame, diffMs, config.theme2);
          }
        }
      });

      return { frames, compareDiffMs };
    }

    return { frames };
  }, [data.series, timeRange]);

  const timezones = useMemo(() => getTimezones(options.timezone, timeZone), [options.timezone, timeZone]);
  const suggestions = useMemo(() => {
    if (frames?.length && frames.every((df) => df.meta?.type === DataFrameType.TimeSeriesLong)) {
      const s = getPrepareTimeseriesSuggestion(id);
      return {
        message: 'Long data must be converted to wide',
        suggestions: s ? [s] : undefined,
      };
    }
    return undefined;
  }, [frames, id]);

  const enableAnnotationCreation = Boolean(canAddAnnotations && canAddAnnotations());
  const [newAnnotationRange, setNewAnnotationRange] = useState<TimeRange2 | null>(null);
  const cursorSync = sync?.() ?? DashboardCursorSync.Off;

  // Quick edit popover (edit mode only)
  const [isPopoverVisible, setPopoverVisible] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef<{ x: number; y: number; baseX: number; baseY: number } | null>(null);

  useEffect(() => {
    if (!isPopoverVisible) {
      return;
    }

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Node)) {
        return;
      }

      const targetEl = target instanceof Element ? target : target instanceof Text ? target.parentElement : null;
      // Ignore react-select interactions (menu is portaled)
      if (targetEl && targetEl.closest('[role="listbox"], [role="combobox"]')) {
        return;
      }

      if (triggerRef.current?.contains(target)) {
        return;
      }

      if (popoverContentRef.current?.contains(target)) {
        return;
      }

      setPopoverVisible(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPopoverVisible(false);
      }
    };

    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, { capture: true });
      window.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [isPopoverVisible]);

  // Drag handling for the quick edit "window"
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const s = dragStartRef.current;
      if (!s) {
        return;
      }
      setDragOffset({
        x: s.baseX + (e.clientX - s.x),
        y: s.baseY + (e.clientY - s.y),
      });
    };

    const onPointerUp = () => {
      dragStartRef.current = null;
    };

    window.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('pointerup', onPointerUp, { capture: true });
    return () => {
      window.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('pointerup', onPointerUp, { capture: true });
    };
  }, []);

  type LegendMode = 'off' | LegendDisplayMode;
  const legendModeOptions: Array<SelectableValue<LegendMode>> = [
    { value: 'off', label: t('timeseries.inline.legend.off', 'Off') },
    { value: LegendDisplayMode.List, label: t('timeseries.inline.legend.list', 'List') },
    { value: LegendDisplayMode.Table, label: t('timeseries.inline.legend.table', 'Table') },
  ];

  const legendPlacementOptions: Array<SelectableValue<'bottom' | 'right'>> = [
    { value: 'bottom', label: t('timeseries.inline.legend.placement.bottom', 'Bottom') },
    { value: 'right', label: t('timeseries.inline.legend.placement.right', 'Right') },
  ];

  const tooltipModeOptions: Array<SelectableValue<TooltipDisplayMode>> = [
    { value: TooltipDisplayMode.None, label: t('timeseries.inline.tooltip.none', 'Off') },
    { value: TooltipDisplayMode.Single, label: t('timeseries.inline.tooltip.single', 'Single') },
    { value: TooltipDisplayMode.Multi, label: t('timeseries.inline.tooltip.multi', 'All') },
  ];

  const currentLegendMode: LegendMode =
    options.legend.showLegend === false || options.legend.displayMode === LegendDisplayMode.Hidden
      ? 'off'
      : options.legend.displayMode;

  if (!frames || suggestions) {
    return (
      <PanelDataErrorView
        panelId={id}
        message={suggestions?.message}
        fieldConfig={fieldConfig}
        data={data}
        needsTimeField={true}
        needsNumberField={true}
        suggestions={suggestions?.suggestions}
      />
    );
  }

  return (
    <div className={styles.root}>
      {isEditing && (
        <div
          className={cx(styles.inlineControls, 'grid-drag-cancel', 'show-on-hover')}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <IconButton
            ref={triggerRef}
            name="sliders-v-alt"
            tooltip={t('timeseries.inline.quickEdit.tooltip', 'Quick edit')}
            onClick={(e) => {
              e.stopPropagation();
              setDragOffset({ x: 0, y: 0 });
              setPopoverVisible((v) => !v);
            }}
          />

          {isPopoverVisible && triggerRef.current && (
            <Popover
              referenceElement={triggerRef.current}
              placement="bottom-end"
              show
              content={
                <div
                  className={styles.popoverContent}
                  ref={popoverContentRef}
                  style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
                >
                  <Stack direction="column" gap={1}>
                    <div
                      className={styles.popoverHeader}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.button !== 0) {
                          return;
                        }
                        dragStartRef.current = {
                          x: e.clientX,
                          y: e.clientY,
                          baseX: dragOffset.x,
                          baseY: dragOffset.y,
                        };
                      }}
                    >
                      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                        <Stack direction="column" gap={0}>
                          <Text variant="body" weight="medium">
                            {t('timeseries.inline.quickEdit.title', 'Quick edit')}
                          </Text>
                          <Text variant="bodySmall" color="secondary" truncate title={title || undefined}>
                            {title
                              ? t('timeseries.inline.quickEdit.panelTitle', 'Time series: {{title}}', { title })
                              : t('timeseries.inline.quickEdit.panelTitle.untitled', 'Time series: Untitled')}
                          </Text>
                        </Stack>
                        <IconButton
                          name="times"
                          size="sm"
                          // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                          aria-label="Close"
                          onClick={() => setPopoverVisible(false)}
                        />
                      </Stack>
                    </div>

                    <div className={styles.popoverDivider} />

                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                      <Text variant="bodySmall" weight="medium">
                        {t('timeseries.inline.quickEdit.legend', 'Legend')}
                      </Text>
                      <Select
                        width={18}
                        value={legendModeOptions.find((o) => o.value === currentLegendMode)}
                        options={legendModeOptions}
                        onChange={(v) => {
                          if (!v?.value) {
                            return;
                          }
                          if (v.value === 'off') {
                            onOptionsChange({
                              ...options,
                              legend: { ...options.legend, showLegend: false, displayMode: LegendDisplayMode.Hidden },
                            });
                            return;
                          }
                          onOptionsChange({
                            ...options,
                            legend: { ...options.legend, showLegend: true, displayMode: v.value },
                          });
                        }}
                      />
                    </Stack>

                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                      <Text variant="bodySmall" weight="medium">
                        {t('timeseries.inline.quickEdit.legendPlacement', 'Legend placement')}
                      </Text>
                      <Select
                        width={18}
                        value={legendPlacementOptions.find((o) => o.value === options.legend.placement)}
                        options={legendPlacementOptions}
                        onChange={(v) =>
                          v?.value && onOptionsChange({ ...options, legend: { ...options.legend, placement: v.value } })
                        }
                      />
                    </Stack>

                    <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                      <Text variant="bodySmall" weight="medium">
                        {t('timeseries.inline.quickEdit.tooltip', 'Tooltip')}
                      </Text>
                      <Select
                        width={18}
                        value={tooltipModeOptions.find((o) => o.value === options.tooltip.mode)}
                        options={tooltipModeOptions}
                        onChange={(v) =>
                          v?.value && onOptionsChange({ ...options, tooltip: { ...options.tooltip, mode: v.value } })
                        }
                      />
                    </Stack>
                  </Stack>
                </div>
              }
            />
          )}
        </div>
      )}

      <TimeSeries
        frames={frames}
        structureRev={data.structureRev}
        timeRange={timeRange}
        timeZone={timezones}
        width={width}
        height={height}
        legend={options.legend}
        options={options}
        replaceVariables={replaceVariables}
        dataLinkPostProcessor={dataLinkPostProcessor}
        cursorSync={cursorSync}
        annotationLanes={options.annotations?.multiLane ? getXAnnotationFrames(data.annotations).length : undefined}
      >
        {(uplotConfig, alignedFrame) => {
          return (
            <>
              {!options.disableKeyboardEvents && <KeyboardPlugin config={uplotConfig} />}
              {cursorSync !== DashboardCursorSync.Off && (
                <EventBusPlugin config={uplotConfig} eventBus={eventBus} frame={alignedFrame} />
              )}
              <XAxisInteractionAreaPlugin config={uplotConfig} queryZoom={onChangeTimeRange} />
              {options.tooltip.mode !== TooltipDisplayMode.None && (
                <TooltipPlugin2
                  config={uplotConfig}
                  hoverMode={
                    options.tooltip.mode === TooltipDisplayMode.Single ? TooltipHoverMode.xOne : TooltipHoverMode.xAll
                  }
                  queryZoom={onChangeTimeRange}
                  clientZoom={true}
                  syncMode={cursorSync}
                  syncScope={eventsScope}
                  getDataLinks={(seriesIdx, dataIdx) =>
                    alignedFrame.fields[seriesIdx].getLinks?.({ valueRowIndex: dataIdx }) ?? []
                  }
                  render={(u, dataIdxs, seriesIdx, isPinned = false, dismiss, timeRange2, viaSync, dataLinks) => {
                    if (enableAnnotationCreation && timeRange2 != null) {
                      setNewAnnotationRange(timeRange2);
                      dismiss();
                      return;
                    }

                    const annotate = () => {
                      let xVal = u.posToVal(u.cursor.left!, 'x');

                      setNewAnnotationRange({ from: xVal, to: xVal });
                      dismiss();
                    };

                    const groupingFilters =
                      seriesIdx !== null && config.featureToggles.perPanelFiltering && getFiltersBasedOnGrouping
                        ? getGroupedFilters(alignedFrame, seriesIdx, getFiltersBasedOnGrouping)
                        : [];

                    return (
                      <TimeSeriesTooltip
                        series={alignedFrame}
                        dataIdxs={dataIdxs}
                        seriesIdx={seriesIdx}
                        mode={viaSync ? TooltipDisplayMode.Multi : options.tooltip.mode}
                        sortOrder={options.tooltip.sort}
                        hideZeros={options.tooltip.hideZeros}
                        isPinned={isPinned}
                        annotate={enableAnnotationCreation ? annotate : undefined}
                        maxHeight={options.tooltip.maxHeight}
                        replaceVariables={replaceVariables}
                        dataLinks={dataLinks}
                        filterByGroupedLabels={
                          config.featureToggles.perPanelFiltering && groupingFilters.length && onAddAdHocFilters
                            ? {
                                onFilterForGroupedLabels: () => onAddAdHocFilters(groupingFilters),
                                onFilterOutGroupedLabels: () =>
                                  onAddAdHocFilters(
                                    groupingFilters.map((item) => ({ ...item, operator: FILTER_OUT_OPERATOR }))
                                  ),
                              }
                            : undefined
                        }
                        canExecuteActions={userCanExecuteActions}
                        compareDiffMs={compareDiffMs}
                      />
                    );
                  }}
                  maxWidth={options.tooltip.maxWidth}
                />
              )}
              {!isVerticallyOriented && (
                <>
                  <AnnotationsPlugin2
                    replaceVariables={replaceVariables}
                    multiLane={options.annotations?.multiLane}
                    annotations={data.annotations ?? []}
                    config={uplotConfig}
                    timeZone={timeZone}
                    newRange={newAnnotationRange}
                    setNewRange={setNewAnnotationRange}
                  />
                  <OutsideRangePlugin config={uplotConfig} onChangeTimeRange={onChangeTimeRange} />
                  {data.annotations && (
                    <ExemplarsPlugin
                      visibleSeries={getVisibleLabels(uplotConfig, frames)}
                      config={uplotConfig}
                      exemplars={data.annotations}
                      timeZone={timeZone}
                      maxHeight={options.tooltip.maxHeight}
                      maxWidth={options.tooltip.maxWidth}
                    />
                  )}
                  {((canEditThresholds && onThresholdsChange) || showThresholds) && (
                    <ThresholdControlsPlugin
                      config={uplotConfig}
                      fieldConfig={fieldConfig}
                      onThresholdsChange={canEditThresholds ? onThresholdsChange : undefined}
                    />
                  )}
                </>
              )}
            </>
          );
        }}
      </TimeSeries>
    </div>
  );
};

const getStyles = (theme: ReturnType<typeof useTheme2>) => ({
  root: css({
    position: 'relative',
    width: '100%',
    height: '100%',
  }),
  inlineControls: css({
    position: 'absolute',
    // Nudge up/right vs Stat to align with panel header buttons
    top: theme.spacing(-4.4),
    right: theme.spacing(3.5),
    zIndex: theme.zIndex.dropdown,
    pointerEvents: 'auto',
  }),
  popoverContent: css({
    padding: theme.spacing(1),
    width: '320px',
    background: theme.isDark ? 'rgba(18, 18, 23, 0.55)' : 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(14px) saturate(180%)',
    WebkitBackdropFilter: 'blur(14px) saturate(180%)',
    border: theme.isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
  }),
  popoverHeader: css({
    userSelect: 'none',
    cursor: 'grab',
    '&:active': {
      cursor: 'grabbing',
    },
  }),
  popoverDivider: css({
    height: 1,
    background: theme.colors.border.weak,
    margin: theme.spacing(0.5, 0),
  }),
});
