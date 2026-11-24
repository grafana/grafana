import memoizeOne from 'memoize-one';
import { useCallback, useMemo, useState } from 'react';

import {
  alignTimeRangeCompareData,
  DashboardCursorSync,
  type DataFrame,
  DataFrameType,
  FieldType,
  type PanelProps,
  shouldAlignTimeCompare,
  useDataLinksContext,
} from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { TooltipDisplayMode, VizOrientation } from '@grafana/schema';
import {
  EventBusPlugin,
  KeyboardPlugin,
  TooltipPlugin2,
  usePanelContext,
  useTheme2,
  XAxisInteractionAreaPlugin,
} from '@grafana/ui';
import { type TimeRange2, TooltipHoverMode } from '@grafana/ui/internal';
import { getAssistantTooltipContext } from 'app/core/components/AssistantTooltip/buildAssistantContext';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';
import { readDashVar } from 'app/core/dashboardStyle/cssVars';
import { getFilterByGroupedLabels } from 'app/features/panel/filters/adhoc';

import { TimeSeriesTooltip } from './TimeSeriesTooltip';
import { type Options } from './panelcfg.gen';
import { AnnotationsPlugin } from './plugins/AnnotationsPlugin';
import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
import { OutsideRangePlugin } from './plugins/OutsideRangePlugin';
import { StoryPlugin } from './plugins/StoryPlugin';
import { applyStoryHighlight, type StoryColors } from './plugins/story';
import { getXAnnotationFrames } from './plugins/utils';
import { getPrepareTimeseriesSuggestion } from './suggestions';
import { getComparisonFieldPairs, getTimezones, prepareGraphableFields } from './utils';

const noAnnotations: DataFrame[] = [];

interface TimeSeriesPanelProps extends PanelProps<Options> {}

export const TimeSeriesPanel = ({
  data,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  onOptionsChange,
  replaceVariables,
  id,
  title,
}: TimeSeriesPanelProps) => {
  const {
    sync,
    eventsScope,
    canAddAnnotations,
    eventBus,
    canExecuteActions,
    getFiltersBasedOnGrouping,
    onAddAdHocFilters,
    openExemplar,
  } = usePanelContext();
  const theme = useTheme2();
  const [storyRoot, setStoryRoot] = useState<HTMLDivElement | null>(null);
  const story = options.story;
  const highlight = story?.highlight?.trim() || undefined;
  const storyColors = useMemo<StoryColors | undefined>(
    () =>
      highlight && storyRoot
        ? {
            subject: readDashVar(storyRoot, 'accent', theme.colors.primary.main),
            context: readDashVar(storyRoot, 'context', theme.colors.text.disabled),
          }
        : undefined,
    [highlight, storyRoot, theme]
  );
  const getVisibleExemplarLabels = useMemo(() => memoizeOne(getVisibleLabels), []);

  const { dataLinkPostProcessor } = useDataLinksContext();

  const userCanExecuteActions = useMemo(() => canExecuteActions?.() ?? false, [canExecuteActions]);
  // Vertical orientation is not available for users through config.
  // It is simplified version of horizontal time series panel and it does not support all plugins.
  const isVerticallyOriented = options.orientation === VizOrientation.Vertical;
  const {
    frames,
    compareDiffMs,
    subjects,
    warning: prepWarning,
  } = useMemo(() => {
    const { frames: prepared, warn } = prepareGraphableFields(data.series, theme, timeRange);
    if (warn) {
      return { frames: prepared, warning: warn };
    }

    const { frames: graphable, subjects } = storyColors
      ? applyStoryHighlight(prepared, highlight, storyColors, theme)
      : { frames: prepared, subjects: undefined };

    const compareDiffMs: number[] = [0];

    const frames = graphable.map((frame: DataFrame) => {
      const diffMs = frame.meta?.timeCompare?.diffMs ?? 0;

      frame.fields.forEach((field) => {
        if (field.type !== FieldType.time) {
          compareDiffMs.push(diffMs);
        }
      });

      if (diffMs !== 0) {
        // Only shift a compare frame that still sits in its historical window, so repeated
        // preparation of already aligned frames doesn't shift them again
        const needsAlignment = shouldAlignTimeCompare(frame, timeRange);

        if (needsAlignment) {
          return alignTimeRangeCompareData(frame, diffMs, theme);
        }
      }

      return frame;
    });

    return { frames, compareDiffMs, subjects };
  }, [data.series, timeRange, theme, highlight, storyColors]);

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

  const onPinnedToSidebarChange = useCallback(
    (pinned: boolean) => {
      onOptionsChange({ ...options, legend: { ...options.legend, facetedFilterPinned: pinned } });
    },
    [onOptionsChange, options]
  );

  const getFilterByGroupedLabelsModel = useCallback(
    (frame: DataFrame, seriesIdx: number | null | undefined) =>
      getFilterByGroupedLabels(frame, seriesIdx, getFiltersBasedOnGrouping, onAddAdHocFilters, {
        checkFilterablePanelsFlag: false,
      }),
    [getFiltersBasedOnGrouping, onAddAdHocFilters]
  );

  if (!frames?.length || suggestions) {
    return (
      <PanelDataErrorView
        panelId={id}
        message={suggestions?.message ?? prepWarning}
        fieldConfig={fieldConfig}
        data={data}
        needsTimeField={true}
        needsNumberField={true}
        suggestions={suggestions?.suggestions}
      />
    );
  }

  const chart = (
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
      onPinnedToSidebarChange={onPinnedToSidebarChange}
    >
      {(uplotConfig, alignedFrame) => {
        const compFieldPairs = getComparisonFieldPairs(alignedFrame, frames!);
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

                  return (
                    // not sure it header time here works for annotations, since it's taken from nearest datapoint index
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
                      filterByGroupedLabels={getFilterByGroupedLabelsModel(alignedFrame, seriesIdx)}
                      canExecuteActions={userCanExecuteActions}
                      timeCompare={{
                        diffMs: compareDiffMs,
                        fieldPairs: compFieldPairs,
                        colorMode: options.timeCompare?.colorMode,
                      }}
                      assistantContext={getAssistantTooltipContext({ id, title, timeRange, data }, frames)}
                    />
                  );
                }}
                maxWidth={options.tooltip.maxWidth}
              />
            )}
            {!isVerticallyOriented && (
              <>
                <AnnotationsPlugin
                  replaceVariables={replaceVariables}
                  options={options.annotations}
                  annotations={data.annotations}
                  config={uplotConfig}
                  timeZone={timeZone}
                  newRange={newAnnotationRange}
                  setNewRange={setNewAnnotationRange}
                />
                <OutsideRangePlugin config={uplotConfig} onChangeTimeRange={onChangeTimeRange} />
                <ExemplarsPlugin
                  openExemplar={openExemplar}
                  visibleSeries={getVisibleExemplarLabels(uplotConfig, frames)}
                  config={uplotConfig}
                  exemplars={data.annotations ?? noAnnotations}
                  timeZone={timeZone}
                  maxHeight={options.tooltip.maxHeight}
                  maxWidth={options.tooltip.maxWidth}
                />
                {story && (story.directLabels || story.annotationLabels) && (
                  <StoryPlugin
                    config={uplotConfig}
                    alignedFrame={alignedFrame}
                    annotations={data.annotations}
                    story={story}
                    subjects={subjects}
                  />
                )}
              </>
            )}
          </>
        );
      }}
    </TimeSeries>
  );

  if (!highlight) {
    return chart;
  }

  // the style variables that colour the highlight are read from this element, so the chart waits for it
  return <div ref={setStoryRoot}>{storyRoot && chart}</div>;
};
