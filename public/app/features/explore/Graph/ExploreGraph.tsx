import { css } from '@emotion/css';
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
  GrafanaTheme2,
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
import {
  Button,
  Icon,
  PanelContext,
  PanelContextProvider,
  SeriesVisibilityChangeMode,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { GraphFieldConfig } from 'app/plugins/panel/graph/types';
import { defaultGraphConfig, getGraphFieldConfig } from 'app/plugins/panel/timeseries/config';
import { PanelOptions as TimeSeriesOptions } from 'app/plugins/panel/timeseries/panelcfg.gen';
import { ExploreGraphStyle } from 'app/types';

import { seriesVisibilityConfigFactory } from '../../dashboard/dashgrid/SeriesVisibilityConfigFactory';

import { applyGraphStyle, applyThresholdsConfig } from './exploreGraphStyleUtils';
import { useStructureRev } from './useStructureRev';

const MAX_NUMBER_OF_TIME_SERIES = 20;

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
}: Props) {
  const theme = useTheme2();
  const style = useStyles2(getStyles);
  const [showAllTimeSeries, setShowAllTimeSeries] = useState(false);

  const timeRange = {
    from: dateTime(absoluteRange.from),
    to: dateTime(absoluteRange.to),
    raw: {
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
    },
  };

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

  const dataWithConfig = useMemo(() => {
    return applyFieldOverrides({
      fieldConfig: styledFieldConfig,
      data: showAllTimeSeries ? data : data.slice(0, MAX_NUMBER_OF_TIME_SERIES),
      timeZone,
      replaceVariables: (value) => value, // We don't need proper replace here as it is only used in getLinks and we use getFieldLinks
      theme,
      fieldConfigRegistry,
    });
  }, [fieldConfigRegistry, data, timeZone, theme, styledFieldConfig, showAllTimeSeries]);

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
    eventBus,
    sync: () => DashboardCursorSync.Crosshair,
    onSplitOpen: splitOpenFn,
    onToggleSeriesVisibility(label: string, mode: SeriesVisibilityChangeMode) {
      setFieldConfig(seriesVisibilityConfigFactory(label, mode, fieldConfig, data));
    },
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
      {data.length > MAX_NUMBER_OF_TIME_SERIES && !showAllTimeSeries && (
        <div className={style.timeSeriesDisclaimer}>
          <Icon className={style.disclaimerIcon} name="exclamation-triangle" />
          Showing only {MAX_NUMBER_OF_TIME_SERIES} time series.
          <Button
            variant="primary"
            fill="text"
            onClick={() => setShowAllTimeSeries(true)}
            className={style.showAllButton}
          >
            Show all {data.length}
          </Button>
        </div>
      )}
      <PanelRenderer
        data={{ series: dataWithConfig, timeRange, state: loadingState, annotations, structureRev }}
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

const getStyles = (theme: GrafanaTheme2) => ({
  timeSeriesDisclaimer: css`
    label: time-series-disclaimer;
    margin: ${theme.spacing(1)} auto;
    padding: 10px 0;
    text-align: center;
  `,
  disclaimerIcon: css`
    label: disclaimer-icon;
    color: ${theme.colors.warning.main};
    margin-right: ${theme.spacing(0.5)};
  `,
  showAllButton: css`
    margin-left: ${theme.spacing(0.5)};
  `,
});
