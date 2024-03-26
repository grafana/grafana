import { identity } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { usePrevious } from 'react-use';

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
  TimeZone,
  VizLegendOptions,
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
  vizLegendOverrides?: Partial<VizLegendOptions>;
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
  vizLegendOverrides,
}: Props) {
  const theme = useTheme2();
  const previousTimeRange = usePrevious(absoluteRange);
  const baseTimeRange = loadingState === LoadingState.Loading && previousTimeRange ? previousTimeRange : absoluteRange;
  const timeRange = useMemo(
    () => ({
      from: dateTime(baseTimeRange.from),
      to: dateTime(baseTimeRange.to),
      raw: {
        from: dateTime(baseTimeRange.from),
        to: dateTime(baseTimeRange.to),
      },
    }),
    [baseTimeRange.from, baseTimeRange.to]
  );

  const fieldConfigRegistry = useMemo(
    () => createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Explore'),
    []
  );

  const [fieldConfig, setFieldConfig] = useState<FieldConfigSource<GraphFieldConfig>>({
    defaults: {
      min: anchorToZero ? 0 : undefined,
      max: yAxisMaximum || undefined,
      unit: 'short',
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
      data,
      timeZone,
      replaceVariables: (value) => value, // We don't need proper replace here as it is only used in getLinks and we use getFieldLinks
      theme,
      fieldConfigRegistry,
      dataLinkPostProcessor,
    });
  }, [fieldConfigRegistry, data, timeZone, theme, styledFieldConfig, dataLinkPostProcessor]);

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
    // TODO: Re-enable DashboardCursorSync.Crosshair when #81505 is fixed
    sync: () => DashboardCursorSync.Off,
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
        ...vizLegendOverrides,
      },
    }),
    [tooltipDisplayMode, vizLegendOverrides]
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
