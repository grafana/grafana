import {
  AbsoluteTimeRange,
  applyFieldOverrides,
  compareArrayValues,
  compareDataFrameStructures,
  createFieldConfigRegistry,
  DataFrame,
  dateTime,
  Field,
  FieldColorModeId,
  FieldConfigSource,
  getFrameDisplayName,
  GrafanaTheme2,
  TimeZone,
} from '@grafana/data';
import {
  DrawStyle,
  Icon,
  LegendDisplayMode,
  PanelContext,
  PanelContextProvider,
  SeriesVisibilityChangeMode,
  TimeSeries,
  TooltipDisplayMode,
  TooltipPlugin,
  useStyles2,
  useTheme2,
  ZoomPlugin,
} from '@grafana/ui';
import { defaultGraphConfig, getGraphFieldConfig } from 'app/plugins/panel/timeseries/config';
import { ContextMenuPlugin } from 'app/plugins/panel/timeseries/plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from 'app/plugins/panel/timeseries/plugins/ExemplarsPlugin';
import { css, cx } from '@emotion/css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getFieldLinksForExplore } from './utils/links';
import { usePrevious } from 'react-use';
import appEvents from 'app/core/app_events';
import { seriesVisibilityConfigFactory } from '../dashboard/dashgrid/SeriesVisibilityConfigFactory';
import { identity } from 'lodash';
import { SplitOpen } from 'app/types/explore';

const MAX_NUMBER_OF_TIME_SERIES = 20;

interface Props {
  data: DataFrame[];
  height: number;
  width: number;
  annotations?: DataFrame[];
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  onUpdateTimeRange: (absoluteRange: AbsoluteTimeRange) => void;
  onHiddenSeriesChanged?: (hiddenSeries: string[]) => void;
  tooltipDisplayMode: TooltipDisplayMode;
  splitOpenFn?: SplitOpen;
}

export function ExploreGraphNGPanel({
  data,
  height,
  width,
  timeZone,
  absoluteRange,
  onUpdateTimeRange,
  annotations,
  tooltipDisplayMode,
  splitOpenFn,
  onHiddenSeriesChanged,
}: Props) {
  const theme = useTheme2();
  const [showAllTimeSeries, setShowAllTimeSeries] = useState(false);
  const [baseStructureRev, setBaseStructureRev] = useState(1);

  const previousData = usePrevious(data);
  const structureChangesRef = useRef(0);

  if (data && previousData && !compareArrayValues(previousData, data, compareDataFrameStructures)) {
    structureChangesRef.current++;
  }

  const structureRev = baseStructureRev + structureChangesRef.current;

  const [fieldConfig, setFieldConfig] = useState<FieldConfigSource>({
    defaults: {
      color: {
        mode: FieldColorModeId.PaletteClassic,
      },
      custom: {
        drawStyle: DrawStyle.Line,
        fillOpacity: 0,
        pointSize: 5,
      },
    },
    overrides: [],
  });

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
    return applyFieldOverrides({
      fieldConfig,
      data,
      timeZone,
      replaceVariables: (value) => value, // We don't need proper replace here as it is only used in getLinks and we use getFieldLinks
      theme,
      fieldConfigRegistry: registry,
    });
  }, [fieldConfig, data, timeZone, theme]);

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

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn, range: timeRange });
  };

  const panelContext: PanelContext = {
    eventBus: appEvents,
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
      <TimeSeries
        frames={seriesToShow}
        structureRev={structureRev}
        width={width}
        height={height}
        timeRange={timeRange}
        legend={{ displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] }}
        timeZone={timeZone}
      >
        {(config, alignedDataFrame) => {
          return (
            <>
              <ZoomPlugin config={config} onZoom={onUpdateTimeRange} />
              <TooltipPlugin config={config} data={alignedDataFrame} mode={tooltipDisplayMode} timeZone={timeZone} />
              <ContextMenuPlugin config={config} data={alignedDataFrame} timeZone={timeZone} />
              {annotations && (
                <ExemplarsPlugin
                  config={config}
                  exemplars={annotations}
                  timeZone={timeZone}
                  getFieldLinks={getFieldLinks}
                />
              )}
            </>
          );
        }}
      </TimeSeries>
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
