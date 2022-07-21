import { css, cx } from '@emotion/css';
import { identity } from 'lodash';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePrevious } from 'react-use';

import {
  AbsoluteTimeRange,
  applyFieldOverrides,
  compareArrayValues,
  compareDataFrameStructures,
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
import appEvents from 'app/core/app_events';
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
  splitOpenFn?: SplitOpen;
  onChangeTime: (timeRange: AbsoluteTimeRange) => void;
  graphStyle: ExploreGraphStyle;
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
}: Props) {
  const theme = useTheme2();
  const [showAllTimeSeries, setShowAllTimeSeries] = useState(false);
  const [baseStructureRev, setBaseStructureRev] = useState(1);

  const previousData = usePrevious(data);
  const structureChangesRef = useRef(0);
  const structureRev = baseStructureRev + structureChangesRef.current;
  const prevStructureRev = usePrevious(structureRev);

  const [fieldConfig, setFieldConfig] = useState<FieldConfigSource>({
    defaults: {
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

  if (data && previousData && !compareArrayValues(previousData, data, compareDataFrameStructures)) {
    structureChangesRef.current++;

    if (prevStructureRev === structureRev) {
      setFieldConfig({ ...fieldConfig, overrides: [] });
    }
  }

  const style = useStyles2(getStyles);
  const timeRange = {
    from: dateTime(absoluteRange.from),
    to: dateTime(absoluteRange.to),
    raw: {
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
    },
  };

  const dataWithConfig = useMemo(() => {
    const registry = createFieldConfigRegistry(getGraphFieldConfig(defaultGraphConfig), 'Explore');
    const styledFieldConfig = applyGraphStyle(fieldConfig, graphStyle);
    return applyFieldOverrides({
      fieldConfig: styledFieldConfig,
      data,
      timeZone,
      replaceVariables: (value) => value, // We don't need proper replace here as it is only used in getLinks and we use getFieldLinks
      theme,
      fieldConfigRegistry: registry,
    });
  }, [fieldConfig, graphStyle, data, timeZone, theme]);

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
    eventBus: appEvents,
    onSplitOpen: splitOpenFn,
    onToggleSeriesVisibility(label: string, mode: SeriesVisibilityChangeMode) {
      setBaseStructureRev((r) => r + 1);
      setFieldConfig(seriesVisibilityConfigFactory(label, mode, fieldConfig, data));
    },
  };

  return (
    <PanelContextProvider value={panelContext}>
      {dataWithConfig.length > MAX_NUMBER_OF_TIME_SERIES && !showAllTimeSeries && (
        <div className={cx([style.timeSeriesDisclaimer])}>
          <Icon className={style.disclaimerIcon} name="exclamation-triangle" />
          {`Showing only ${MAX_NUMBER_OF_TIME_SERIES} time series. `}
          <span
            className={cx([style.showAllTimeSeries])}
            onClick={() => {
              structureChangesRef.current++;
              setShowAllTimeSeries(true);
            }}
          >{`Show all ${dataWithConfig.length}`}</span>
        </div>
      )}
      <PanelRenderer
        data={{ series: seriesToShow, timeRange, structureRev, state: loadingState, annotations }}
        pluginId="timeseries"
        title=""
        width={width}
        height={height}
        onChangeTimeRange={onChangeTime}
        timeZone={timeZone}
        options={
          {
            tooltip: { mode: tooltipDisplayMode, sort: SortOrder.None },
            legend: {
              displayMode: LegendDisplayMode.List,
              showLegend: true,
              placement: 'bottom',
              calcs: [],
            },
          } as TimeSeriesOptions
        }
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
