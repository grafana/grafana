import { AbsoluteTimeRange, DataFrame, dateTime, GrafanaTheme, TimeZone } from '@grafana/data';
import {
  Canvas,
  Collapse,
  GraphNG,
  Icon,
  LegendDisplayMode,
  LegendPlugin,
  TooltipPlugin,
  useStyles,
  ZoomPlugin,
} from '@grafana/ui';
import { ExemplarsPlugin } from 'app/plugins/panel/graph3/plugins/ExemplarsPlugin';
import { VizLayout } from 'app/plugins/panel/graph3/VizLayout';
import { css, cx } from 'emotion';
import React, { useState } from 'react';

const MAX_NUMBER_OF_TIME_SERIES = 20;

interface Props {
  data: DataFrame[];
  annotations?: DataFrame[];
  isLoading: boolean;
  width: number;
  absoluteRange: AbsoluteTimeRange;
  timeZone: TimeZone;
  onUpdateTimeRange: (absoluteRange: AbsoluteTimeRange) => void;
}

export function ExploreGraphNGPanel({
  width,
  data,
  timeZone,
  absoluteRange,
  onUpdateTimeRange,
  isLoading,
  annotations,
}: Props) {
  const [showAllTimeSeries, setShowAllTimeSeries] = useState(false);
  const style = useStyles(getStyles);
  const timeRange = {
    from: dateTime(absoluteRange.from),
    to: dateTime(absoluteRange.to),
    raw: {
      from: dateTime(absoluteRange.from),
      to: dateTime(absoluteRange.to),
    },
  };

  const seriesToShow = showAllTimeSeries ? data : data.slice(0, MAX_NUMBER_OF_TIME_SERIES);

  return (
    <>
      {data.length > MAX_NUMBER_OF_TIME_SERIES && !showAllTimeSeries && (
        <div className={cx([style.timeSeriesDisclaimer])}>
          <Icon className={style.disclaimerIcon} name="exclamation-triangle" />
          {`Showing only ${MAX_NUMBER_OF_TIME_SERIES} time series. `}
          <span
            className={cx([style.showAllTimeSeries])}
            onClick={() => setShowAllTimeSeries(true)}
          >{`Show all ${data.length}`}</span>
        </div>
      )}

      <Collapse label="Graph" loading={isLoading} isOpen>
        <VizLayout width={width - 20} height={300}>
          {({ builder, getLayout }) => {
            const layout = getLayout();
            // when all layout slots are ready we can calculate the canvas(actual viz) size
            const canvasSize = layout.isReady
              ? {
                  width: width - 20 - (layout.left.width + layout.right.width),
                  height: 300 - (layout.top.height + layout.bottom.height),
                }
              : { width: 0, height: 0 };
            builder.addSlot('bottom', <LegendPlugin placement="bottom" displayMode={LegendDisplayMode.List} />);

            return (
              <GraphNG timeRange={timeRange} timeZone={timeZone} data={seriesToShow} {...canvasSize}>
                {builder.addSlot('canvas', <Canvas />).render()}
                <TooltipPlugin mode="single" timeZone={timeZone} />
                <ZoomPlugin onZoom={onUpdateTimeRange} />

                {annotations && <ExemplarsPlugin exemplars={annotations} timeZone={timeZone} />}
              </GraphNG>
            );
          }}
        </VizLayout>
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
