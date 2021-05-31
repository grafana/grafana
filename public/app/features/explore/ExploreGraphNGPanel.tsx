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
  GrafanaTheme,
  TimeZone,
} from '@grafana/data';
import {
  Collapse,
  DrawStyle,
  GraphNGLegendEvent,
  Icon,
  LegendDisplayMode,
  TooltipPlugin,
  useStyles,
  useTheme2,
  ZoomPlugin,
  TooltipDisplayMode,
  TimeSeries,
} from '@grafana/ui';
import { defaultGraphConfig, getGraphFieldConfig } from 'app/plugins/panel/timeseries/config';
import { hideSeriesConfigFactory } from 'app/plugins/panel/timeseries/overrides/hideSeriesConfigFactory';
import { ContextMenuPlugin } from 'app/plugins/panel/timeseries/plugins/ContextMenuPlugin';
import { ExemplarsPlugin } from 'app/plugins/panel/timeseries/plugins/ExemplarsPlugin';
import { css, cx } from '@emotion/css';
import React, { useCallback, useMemo, useState, useRef } from 'react';
import { splitOpen } from './state/main';
import { getFieldLinksForExplore } from './utils/links';
import { usePrevious } from 'react-use';

const MAX_NUMBER_OF_TIME_SERIES = 20;

interface Props {
  data: DataFrame[];
  annotations?: DataFrame[];
  isLoading: boolean;
  width: number;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  onUpdateTimeRange: (absoluteRange: AbsoluteTimeRange) => void;
  splitOpenFn: typeof splitOpen;
}

export function ExploreGraphNGPanel({
  width,
  data,
  timeZone,
  absoluteRange,
  onUpdateTimeRange,
  isLoading,
  annotations,
  splitOpenFn,
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

  const style = useStyles(getStyles);
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

  const onLegendClick = useCallback(
    (event: GraphNGLegendEvent) => {
      setBaseStructureRev((r) => r + 1);
      setFieldConfig(hideSeriesConfigFactory(event, fieldConfig, data));
    },
    [fieldConfig, data]
  );

  const seriesToShow = showAllTimeSeries ? dataWithConfig : dataWithConfig.slice(0, MAX_NUMBER_OF_TIME_SERIES);

  const getFieldLinks = (field: Field, rowIndex: number) => {
    return getFieldLinksForExplore({ field, rowIndex, splitOpenFn, range: timeRange });
  };

  return (
    <>
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

      <Collapse label="Graph" loading={isLoading} isOpen>
        <TimeSeries
          frames={seriesToShow}
          structureRev={structureRev}
          width={width}
          height={400}
          timeRange={timeRange}
          onLegendClick={onLegendClick}
          legend={{ displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] }}
          timeZone={timeZone}
        >
          {(config, alignedDataFrame) => {
            return (
              <>
                <ZoomPlugin config={config} onZoom={onUpdateTimeRange} />
                <TooltipPlugin
                  config={config}
                  data={alignedDataFrame}
                  mode={TooltipDisplayMode.Single}
                  timeZone={timeZone}
                />
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
      </Collapse>
    </>
  );
}

const getStyles = (theme: GrafanaTheme) => ({
  timeSeriesDisclaimer: css`
    label: time-series-disclaimer;
    width: 300px;
    margin: ${theme.spacing.sm} auto;
    padding: 10px 0;
    border-radius: ${theme.border.radius.md};
    text-align: center;
    background-color: ${theme.colors.bg1};
  `,
  disclaimerIcon: css`
    label: disclaimer-icon;
    color: ${theme.palette.yellow};
    margin-right: ${theme.spacing.xs};
  `,
  showAllTimeSeries: css`
    label: show-all-time-series;
    cursor: pointer;
    color: ${theme.colors.linkExternal};
  `,
});
