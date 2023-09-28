import { identity } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';

import {
  AbsoluteTimeRange,
  applyFieldOverrides,
  createFieldConfigRegistry,
  DataFrame,
  dateTime,
  FieldColorModeId,
  FieldConfigSource,
  getFrameDisplayName,
  LoadingState,
  SplitOpen,
  TimeZone,
  ThresholdsConfig,
  DashboardCursorSync,
  EventBus,
} from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import {
  GraphDrawStyle,
  LegendDisplayMode,
  TooltipDisplayMode,
  SortOrder,
  GraphThresholdsStyleConfig,
} from '@grafana/schema';
import { PanelContext, PanelContextProvider, SeriesVisibilityChangeMode, useTheme2 } from '@grafana/ui';
import { GraphFieldConfig } from 'app/plugins/panel/graph/types';
import { defaultGraphConfig, getGraphFieldConfig } from 'app/plugins/panel/timeseries/config';
import { Options as TimeSeriesOptions } from 'app/plugins/panel/timeseries/panelcfg.gen';
import { ExploreGraphStyle } from 'app/types';

import { seriesVisibilityConfigFactory } from '../../dashboard/dashgrid/SeriesVisibilityConfigFactory';
import { useExploreDataLinkPostProcessor } from '../hooks/useExploreDataLinkPostProcessor';

import { applyGraphStyle, applyThresholdsConfig } from './exploreGraphStyleUtils';
import { useStructureRev } from './useStructureRev';

export const MAX_NUMBER_OF_TIME_SERIES = 20;

interface Props {
  data: DataFrame[];
  height: number;
  width: number;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  loadingState: LoadingState;
  annotations?: DataFrame[];
  onHiddenSeriesChanged?: (hiddenSeries: string[]) => void;
  tooltipDisplayMode?: TooltipDisplayMode;
  splitOpenFn: SplitOpen;
  onChangeTime: (timeRange: AbsoluteTimeRange) => void;
  graphStyle: ExploreGraphStyle;
  anchorToZero?: boolean;
  yAxisMaximum?: number;
  thresholdsConfig?: ThresholdsConfig;
  thresholdsStyle?: GraphThresholdsStyleConfig;
  eventBus: EventBus;
  showAllTimeSeries: boolean;
}

export function ExploreGraph({
  data,
  height,
  width,
  timeZone,
  absoluteRange,
  onChangeTime,
  loadingState,
  annotations,
  onHiddenSeriesChanged,
  splitOpenFn,
  graphStyle,
  tooltipDisplayMode = TooltipDisplayMode.Single,
  anchorToZero = false,
  yAxisMaximum,
  thresholdsConfig,
  thresholdsStyle,
  eventBus,
  showAllTimeSeries,
}: Props) {
  const theme = useTheme2();

  const timeRange = useMemo(
    () => ({
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
      raw: {
        from: dateTime(absoluteRange.from),
        to: dateTime(absoluteRange.to),
      },
    }),
    [absoluteRange.from, absoluteRange.to]
  );

  const fieldConfigRegistry = useMemo(
    () => createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Explore'),
    []
  );

  const [fieldConfig, setFieldConfig] = useState<FieldConfigSource<GraphFieldConfig>>({
    defaults: {
      min: anchorToZero ? 0 : undefined,
      max: yAxisMaximum || undefined,
      color: {
        mode: FieldColorModeId.PaletteClassic,
      },
      custom: {
        drawStyle: GraphDrawStyle.Line,
        fillOpacity: 0,
        pointSize: 5,
      },
    },
    overrides: [],
  });

  const styledFieldConfig = useMemo(() => {
    const withGraphStyle = applyGraphStyle(fieldConfig, graphStyle, yAxisMaximum);
    return applyThresholdsConfig(withGraphStyle, thresholdsStyle, thresholdsConfig);
  }, [fieldConfig, graphStyle, yAxisMaximum, thresholdsConfig, thresholdsStyle]);

  const dataLinkPostProcessor = useExploreDataLinkPostProcessor(splitOpenFn, timeRange);

  const dataWithConfig = useMemo(() => {
    return applyFieldOverrides({
      fieldConfig: styledFieldConfig,
      data: showAllTimeSeries ? data : data.slice(0, MAX_NUMBER_OF_TIME_SERIES),
      timeZone,
      replaceVariables: (value) => value, // We don't need proper replace here as it is only used in getLinks and we use getFieldLinks
      theme,
      fieldConfigRegistry,
      dataLinkPostProcessor,
    });
  }, [fieldConfigRegistry, data, timeZone, theme, styledFieldConfig, showAllTimeSeries, dataLinkPostProcessor]);

  const annotationsWithConfig = useMemo(() => {
    return applyFieldOverrides({
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
      data: annotations,
      timeZone,
      replaceVariables: (value) => value,
      theme,
      dataLinkPostProcessor,
    });
  }, [annotations, timeZone, theme, dataLinkPostProcessor]);

  const structureRev = useStructureRev(dataWithConfig);

  useEffect(() => {
    if (onHiddenSeriesChanged) {
      const hiddenFrames: string[] = [];
      dataWithConfig.forEach((frame) => {
        const allFieldsHidden = frame.fields.map((field) => field.config?.custom?.hideFrom?.viz).every(identity);
        if (allFieldsHidden) {
          hiddenFrames.push(getFrameDisplayName(frame));
        }
      });
      onHiddenSeriesChanged(hiddenFrames);
    }
  }, [dataWithConfig, onHiddenSeriesChanged]);

  const panelContext: PanelContext = {
    eventsScope: 'explore',
    eventBus,
    sync: () => DashboardCursorSync.Crosshair,
    onToggleSeriesVisibility(label: string, mode: SeriesVisibilityChangeMode) {
      setFieldConfig(seriesVisibilityConfigFactory(label, mode, fieldConfig, data));
    },
    dataLinkPostProcessor,
  };

  const panelOptions: TimeSeriesOptions = useMemo(
    () => ({
      tooltip: { mode: tooltipDisplayMode, sort: SortOrder.None },
      legend: {
        displayMode: LegendDisplayMode.List,
        showLegend: true,
        placement: 'bottom',
        calcs: [],
      },
    }),
    [tooltipDisplayMode]
  );

  return (
    <PanelContextProvider value={panelContext}>
      <PanelRenderer
        data={{
          series: dataWithConfig,
          timeRange,
          state: loadingState,
          annotations: annotationsWithConfig,
          structureRev,
        }}
        pluginId="timeseries"
        title=""
        width={width}
        height={height}
        onChangeTimeRange={onChangeTime}
        timeZone={timeZone}
        options={panelOptions}
      />
    </PanelContextProvider>
  );
}
