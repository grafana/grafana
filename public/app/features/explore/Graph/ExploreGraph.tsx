import { identity, isEqual, sortBy } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as React from 'react';

import {
  AbsoluteTimeRange,
  applyFieldOverrides,
  createFieldConfigRegistry,
  DashboardCursorSync,
  DataFrame,
  EventBus,
  FieldColorModeId,
  FieldConfigSource,
  getFrameDisplayName,
  LoadingState,
  SplitOpen,
  ThresholdsConfig,
  TimeRange,
} from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import {
  GraphDrawStyle,
  GraphFieldConfig,
  GraphThresholdsStyleConfig,
  LegendDisplayMode,
  SortOrder,
  TimeZone,
  TooltipDisplayMode,
  VizLegendOptions,
} from '@grafana/schema';
import { PanelContext, PanelContextProvider, SeriesVisibilityChangeMode, useTheme2 } from '@grafana/ui';
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
  timeRange: TimeRange;
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
  toggleLegendRef?: React.MutableRefObject<(name: string, mode: SeriesVisibilityChangeMode) => void>;
}

export function ExploreGraph({
  data,
  height,
  width,
  timeZone,
  timeRange,
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
  toggleLegendRef,
}: Props) {
  const theme = useTheme2();

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

  const onHiddenSeriesChangedRef = useRef(onHiddenSeriesChanged);
  const previousHiddenFrames = useRef<string[] | undefined>(undefined);

  useEffect(() => {
    if (onHiddenSeriesChangedRef.current) {
      const hiddenFrames: string[] = [];
      dataWithConfig.forEach((frame) => {
        const allFieldsHidden = frame.fields.map((field) => field.config?.custom?.hideFrom?.viz).every(identity);
        if (allFieldsHidden) {
          hiddenFrames.push(getFrameDisplayName(frame));
        }
      });
      if (
        previousHiddenFrames.current === undefined ||
        !isEqual(sortBy(hiddenFrames), sortBy(previousHiddenFrames.current))
      ) {
        previousHiddenFrames.current = hiddenFrames;
        onHiddenSeriesChangedRef.current(hiddenFrames);
      }
    }
  }, [dataWithConfig]);

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

  function toggleLegend(name: string, mode: SeriesVisibilityChangeMode) {
    setFieldConfig(seriesVisibilityConfigFactory(name, mode, fieldConfig, data));
  }

  if (toggleLegendRef) {
    toggleLegendRef.current = toggleLegend;
  }

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
