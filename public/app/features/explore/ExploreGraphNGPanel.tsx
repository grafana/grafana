import { AbsoluteTimeRange, dateTime, GrafanaTheme, LoadingState, PanelData, TimeZone } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Collapse, Icon, useTheme } from '@grafana/ui';
import { GraphPanel } from 'app/plugins/panel/graph3/GraphPanel';
import { css, cx } from 'emotion';
import React, { useState } from 'react';

const MAX_NUMBER_OF_TIME_SERIES = 20;

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

interface Props {
  data: PanelData;
  width: number;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  onUpdateTimeRange: (absoluteRange: AbsoluteTimeRange) => void;
}

export function ExploreGraphNGPanel({ width, data, timeZone, absoluteRange, onUpdateTimeRange }: Props) {
  const [showAllTimeSeries, setShowAllTimeSeries] = useState(false);
  const theme = useTheme();
  const style = getStyles(theme);
  const timeRange = {
    from: dateTime(absoluteRange.from),
    to: dateTime(absoluteRange.to),
    raw: {
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
    },
  };

  const seriesToShow = showAllTimeSeries ? data : { ...data, series: data.series.slice(0, MAX_NUMBER_OF_TIME_SERIES) };

  return (
    <>
      {data.series.length > MAX_NUMBER_OF_TIME_SERIES && !showAllTimeSeries && (
        <div className={cx([style.timeSeriesDisclaimer])}>
          <Icon className={style.disclaimerIcon} name="exclamation-triangle" />
          {`Showing only ${MAX_NUMBER_OF_TIME_SERIES} time series. `}
          <span
            className={cx([style.showAllTimeSeries])}
            onClick={() => setShowAllTimeSeries(true)}
          >{`Show all ${data.series.length}`}</span>
        </div>
      )}

      <Collapse label="Graph" loading={data.state === LoadingState.Loading} isOpen>
        <GraphPanel
          timeRange={timeRange}
          height={300}
          width={width - 20}
          timeZone={timeZone}
          data={seriesToShow}
          fieldConfig={{ defaults: {}, overrides: [] }}
          id={1}
          onChangeTimeRange={onUpdateTimeRange}
          transparent={true}
          title=""
          replaceVariables={getTemplateSrv().replace}
          renderCounter={0}
          options={{
            legend: { isVisible: true, placement: 'bottom', asTable: false },
            graph: { realTimeUpdates: false },
            tooltipOptions: { mode: 'single' },
          }}
          onFieldConfigChange={config => console.log(config)}
          onOptionsChange={options => console.log(options)}
        />
      </Collapse>
    </>
  );
}
