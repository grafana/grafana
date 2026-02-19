import { useMemo, useState } from 'react';

import {
  PanelProps,
  DataFrameType,
  DashboardCursorSync,
  DataFrame,
  alignTimeRangeCompareData,
  shouldAlignTimeCompare,
  useDataLinksContext,
  FieldType,
} from '@grafana/data';
import { config, PanelDataErrorView } from '@grafana/runtime';
import { VizOrientation } from '@grafana/schema';
import {
  EventBusPlugin,
  KeyboardPlugin,
  XAxisInteractionAreaPlugin,
  usePanelContext,
} from '@grafana/ui';
import { TimeRange2 } from '@grafana/ui/internal';
import { TimeSeries } from 'app/core/components/TimeSeries/TimeSeries';

import { Options } from './panelcfg.gen';
import { ExemplarsPlugin, getVisibleLabels } from './plugins/ExemplarsPlugin';
import { OutsideRangePlugin } from './plugins/OutsideRangePlugin';
import { ThresholdControlsPlugin } from './plugins/ThresholdControlsPlugin';
import { getXAnnotationFrames } from './plugins/utils';
import { getPrepareTimeseriesSuggestion } from './suggestions';
import { getTimezones, prepareGraphableFields } from './utils';

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
  replaceVariables,
  id,
}: TimeSeriesPanelProps) => {
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
  } = usePanelContext();

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
    />
  );
};
