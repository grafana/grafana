import { css } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  colorManipulator,
  type DataFrame,
  dateTime,
  type Field,
  FeatureState,
  FieldColorModeId,
  FieldType,
  getDisplayProcessor,
  getTimeZone,
  type GrafanaTheme2,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AxisPlacement,
  GraphDrawStyle,
  type VizAnnotations,
  type VizLegendOptions,
  VisibilityMode,
} from '@grafana/schema';
import { FeatureBadge, IconButton, Popover, useStyles2, useTheme2 } from '@grafana/ui';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';
import { AnnotationsPlugin } from 'app/plugins/panel/timeseries/plugins/AnnotationsPlugin';

import { ContextWindowSelector } from './ContextWindowSelector';
import { TimeNavigatorBrushPlugin } from './TimeNavigatorBrushPlugin';
import { type TimeRangeMs } from './timeModel';
import { useTimeNavigator } from './timeNavigatorState';

/** Fixed height of the time ruler, in px. */
const CHART_HEIGHT = 50;

export interface TimeNavigatorProps {
  /** The dashboard's current absolute time range (epoch ms). */
  value: TimeRangeMs;
  /** `Date.now()` — passed in so the model stays testable and renders stay pure. */
  now: number;
  width: number;
  height: number;
  /** Background sparkline(s): a shared time axis (epoch ms) plus one values array per series. */
  time: number[];
  values: number[][];
  /** Dashboard annotations to mark on the bar (frames tagged with the annotations data topic). */
  annotations?: DataFrame[];
  contextZoomFactor?: number;
  onChangeTimeRange: (range: TimeRangeMs) => void;
  /** Called when the zoomed-out context window changes, so a host can fetch background data for it. */
  onContextWindowChange?: (range: TimeRangeMs) => void;
  /** Extra controls rendered in the control row (e.g. a sparkline-source picker from the hosting surface). */
  extraControls?: React.ReactNode;
}

// AnnotationsPlugin requires an interpolate function and a WIP-range setter; the time navigator creates neither
// (it never edits annotations), so both are inert.
const noopInterpolate = (value: string) => value;
const noopSetNewRange = () => {};

// The time navigator never shows a legend; a stable module-level object keeps TimeSeries from reconfiguring the
// plot every render (its `legend` prop is compared by reference).
const HIDDEN_LEGEND: VizLegendOptions = { showLegend: false, calcs: [], placement: 'bottom' };

// Thin, low-weight annotation lines (the plugin default width is 2) — this is a compact background ruler,
// so keep the markings light.
const ANNOTATION_OPTIONS: VizAnnotations = { lines: { width: 1 } };

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
  }),
  controlRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  }),
  popoverContent: css({
    backgroundColor: theme.colors.background.primary,
    padding: 8,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z2,
  }),
  plotArea: css({
    position: 'relative',
    overflow: 'hidden',
  }),
});

export const TimeNavigator: React.FC<TimeNavigatorProps> = ({
  value,
  now,
  width,
  height,
  time,
  values,
  annotations,
  contextZoomFactor,
  onChangeTimeRange,
  onContextWindowChange,
  extraControls,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const { state, actions } = useTimeNavigator({ value, now, contextZoomFactor, onChangeTimeRange });

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  // The plot-area container the brush plugin portals its selection overlay into (as a DOM sibling of the
  // TimeSeries), so the overlay keeps the same container-px math and pixel alignment.
  const plotAreaRef = useRef<HTMLDivElement>(null);

  const chartWidth = Math.max(0, width);
  const seriesCount = values.length;

  // Faint background sparkline(s) as a single DataFrame: one time field + one number field per series. Each
  // series is drawn faint (distinct theme-palette colors at half alpha) so overlapping series stay
  // distinguishable without competing with the selection overlay.
  const frame = useMemo<DataFrame>(() => {
    const palette = theme.visualization.palette;
    const seriesColor = (i: number) =>
      colorManipulator.alpha(theme.visualization.getColorByName(palette[i % palette.length]), 0.5);

    const timeField: Field = { name: 'time', type: FieldType.time, config: {}, values: time };
    const seriesFields: Field[] = values.map((vals, i) => {
      const field: Field = {
        name: `series-${i}`,
        type: FieldType.number,
        values: vals,
        config: {
          color: { mode: FieldColorModeId.Fixed, fixedColor: seriesColor(i) },
          custom: {
            drawStyle: GraphDrawStyle.Line,
            lineWidth: 1,
            fillOpacity: 0,
            showPoints: VisibilityMode.Never,
            spanNulls: true,
            axisPlacement: AxisPlacement.Hidden,
            // A unique axis label per series makes buildScaleKey produce a distinct y-scale for each, so every
            // sparkline auto-ranges to its own min/max over the context window instead of sharing one scale.
            // The axis is Hidden, so the label text never renders.
            axisLabel: `series-${i}`,
          },
        },
      };
      field.display = getDisplayProcessor({ field, theme });
      return field;
    });

    return { name: 'time-navigator', fields: [timeField, ...seriesFields], length: time.length };
  }, [time, values, theme]);

  // Stable array identity so GraphNG doesn't re-align + re-setData on every render (it re-aligns whenever
  // the `frames` reference changes) — e.g. during a selection drag. Only changes when `frame` does.
  const frames = useMemo(() => [frame], [frame]);

  // Bump only when the frame structure (series count) changes, so TimeSeries re-inits the plot/config then
  // but NOT on every background-data update (which would reset the plot).
  const structureRevRef = useRef(0);
  const prevSeriesCount = useRef(seriesCount);
  if (prevSeriesCount.current !== seriesCount) {
    prevSeriesCount.current = seriesCount;
    structureRevRef.current += 1;
  }
  const structureRev = structureRevRef.current;

  // Drive the x-scale from the CONTEXT WINDOW (not the dashboard range). TimeSeries reads this via
  // getTimeRange for its x-scale range fn; the brush plugin additionally pushes it imperatively because
  // TimeSeries only re-reads the range on data/size/config changes, and the context window can move alone.
  const contextTimeRange = useMemo<TimeRange>(() => {
    const from = dateTime(state.contextWindow.from);
    const to = dateTime(state.contextWindow.to);
    return { from, to, raw: { from, to } };
  }, [state.contextWindow.from, state.contextWindow.to]);

  const tz = getTimeZone();

  // Report context-window changes so a host can fetch background data for the visible range.
  const onContextWindowChangeRef = useRef(onContextWindowChange);
  onContextWindowChangeRef.current = onContextWindowChange;
  useEffect(() => {
    onContextWindowChangeRef.current?.({ from: state.contextWindow.from, to: state.contextWindow.to });
  }, [state.contextWindow.from, state.contextWindow.to]);

  return (
    <div className={styles.wrapper} style={{ width, height }} data-testid="time-navigator">
      <div className={styles.controlRow}>
        <IconButton
          name="calendar-alt"
          tooltip={t('time-navigator.set-context-window', 'Set context window')}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        />
        {anchorEl && (
          <Popover
            referenceElement={anchorEl}
            show={true}
            content={
              <div className={styles.popoverContent}>
                <ContextWindowSelector
                  contextWindow={state.contextWindow}
                  onApplyRelative={actions.applyRelativeContext}
                  onApplyAbsolute={actions.applyAbsoluteContext}
                  onClose={() => setAnchorEl(null)}
                />
              </div>
            }
          />
        )}
        <IconButton
          tooltip={t('time-navigator.pan-left', 'Pan left')}
          name="arrow-left"
          onClick={() => actions.pan('left')}
        />
        <IconButton
          tooltip={t('time-navigator.zoom-out', 'Zoom out context')}
          name="search-minus"
          onClick={() => actions.zoom(2)}
        />
        <IconButton
          tooltip={t('time-navigator.zoom-in', 'Zoom in context')}
          name="search-plus"
          onClick={() => actions.zoom(0.5)}
        />
        <IconButton
          tooltip={t('time-navigator.pan-right', 'Pan right')}
          name="arrow-right"
          onClick={() => actions.pan('right')}
        />
        <IconButton
          tooltip={t('time-navigator.reset', 'Reset context window')}
          name="crosshair"
          onClick={() => actions.reset()}
        />
        {extraControls}
        <FeatureBadge
          featureState={FeatureState.experimental}
          tooltip={t(
            'time-navigator.experimental-info',
            'Experimental. Sparkline and annotation selections are saved in your browser only (per dashboard), not in the dashboard.'
          )}
        />
      </div>

      <div ref={plotAreaRef} className={styles.plotArea} style={{ width: chartWidth, height: CHART_HEIGHT }}>
        {chartWidth > 0 && (
          <TimeSeries
            frames={frames}
            timeRange={contextTimeRange}
            timeZone={tz}
            width={chartWidth}
            height={CHART_HEIGHT}
            legend={HIDDEN_LEGEND}
            structureRev={structureRev}
            replaceVariables={noopInterpolate}
          >
            {(config) => (
              <>
                <TimeNavigatorBrushPlugin
                  config={config}
                  state={state}
                  actions={actions}
                  width={chartWidth}
                  plotAreaRef={plotAreaRef}
                />
                <AnnotationsPlugin
                  config={config}
                  annotations={annotations}
                  timeZone={tz}
                  newRange={null}
                  setNewRange={noopSetNewRange}
                  options={ANNOTATION_OPTIONS}
                  replaceVariables={noopInterpolate}
                />
              </>
            )}
          </TimeSeries>
        )}
      </div>
    </div>
  );
};
