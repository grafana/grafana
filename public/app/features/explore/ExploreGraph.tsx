import { css, cx } from '@emotion/css';
import { identity } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useCounter } from 'react-use';

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
  DashboardCursorSync,
  EventBus,
} from '@grafana/data';
import { PanelRenderer } from '@grafana/runtime';
import { GraphDrawStyle, LegendDisplayMode, TooltipDisplayMode, SortOrder } from '@grafana/schema';
import {
  Icon,
  PanelContext,
  PanelContextProvider,
  SeriesVisibilityChangeMode,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { defaultGraphConfig, getGraphFieldConfig } from 'app/plugins/panel/timeseries/config';
import { TimeSeriesOptions } from 'app/plugins/panel/timeseries/types';

import { ExploreGraphStyle } from '../../types';
import { seriesVisibilityConfigFactory } from '../dashboard/dashgrid/SeriesVisibilityConfigFactory';

import { applyGraphStyle } from './exploreGraphStyleUtils';

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
  anchorToZero: boolean;
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
  anchorToZero,
  eventBus,
}: Props) {
  const theme = useTheme2();
  const style = useStyles2(getStyles);
  const [showAllTimeSeries, setShowAllTimeSeries] = useState(false);
  const [structureRev, { inc: incrementStructureRev }] = useCounter(1);
  const fieldConfigRegistry = useMemo(
    () => createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Explore'),
    []
  );

  const [fieldConfig, setFieldConfig] = useState<FieldConfigSource>({
    defaults: {
      min: anchorToZero ? 0 : undefined,
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

  const timeRange = {
    from: dateTime(absoluteRange.from),
    to: dateTime(absoluteRange.to),
    raw: {
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
    },
  };

  const styledFieldConfig = useMemo(() => applyGraphStyle(fieldConfig, graphStyle), [fieldConfig, graphStyle]);

  const dataWithConfig = useMemo(() => {
    return applyFieldOverrides({
      fieldConfig: styledFieldConfig,
      data,
      timeZone,
      replaceVariables: (value) => value, // We don't need proper replace here as it is only used in getLinks and we use getFieldLinks
      theme,
      fieldConfigRegistry,
    });
  }, [fieldConfigRegistry, data, timeZone, theme, styledFieldConfig]);

  // structureRev should be incremented when either the number of series or the config changes.
  // like useEffect, but runs before rendering.
  // TODO: while this works as it is supposed to, we are forced to do this now because of the way
  // ExploreGraph is implemented. We should refactor it to a single component that handles structureRev increments
  // when a user changes the viz style and not react to the value change itself.
  useMemo(incrementStructureRev, [dataWithConfig.length, styledFieldConfig, incrementStructureRev]);

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

  const seriesToShow = showAllTimeSeries ? dataWithConfig : dataWithConfig.slice(0, MAX_NUMBER_OF_TIME_SERIES);

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
      {dataWithConfig.length > MAX_NUMBER_OF_TIME_SERIES && !showAllTimeSeries && (
        <div className={cx([style.timeSeriesDisclaimer])}>
          <Icon className={style.disclaimerIcon} name="exclamation-triangle" />
          {`Showing only ${MAX_NUMBER_OF_TIME_SERIES} time series. `}
          <span
            className={cx([style.showAllTimeSeries])}
            onClick={() => {
              setShowAllTimeSeries(true);
            }}
          >{`Show all ${dataWithConfig.length}`}</span>
        </div>
      )}
      <PanelRenderer
        data={{ series: seriesToShow, timeRange, state: loadingState, annotations, structureRev }}
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
    width: 300px;
    margin: ${theme.spacing(1)} auto;
    padding: 10px 0;
    border-radius: ${theme.spacing(2)};
    text-align: center;
    background-color: ${theme.colors.background.primary};
  `,
  disclaimerIcon: css`
    label: disclaimer-icon;
    color: ${theme.colors.warning.main};
    margin-right: ${theme.spacing(0.5)};
  `,
  showAllTimeSeries: css`
    label: show-all-time-series;
    cursor: pointer;
    color: ${theme.colors.text.link};
  `,
});
