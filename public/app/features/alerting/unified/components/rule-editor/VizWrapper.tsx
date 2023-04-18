import { css } from '@emotion/css';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import {
  AbsoluteTimeRange,
  DataFrame,
  GrafanaTheme2,
  isTimeSeriesFrames,
  PanelData,
  ThresholdsConfig,
} from '@grafana/data';
import { GraphTresholdsStyleMode, LoadingState } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { GraphContainer } from 'app/features/explore/Graph/GraphContainer';
import { RawPrometheusContainer } from 'app/features/explore/RawPrometheusContainer';
import { toTimeSeriesMulti } from 'app/features/transformers/prepareTimeSeries/prepareTimeSeries';
import { ExploreId } from 'app/types/explore';


interface Props {
  data: PanelData;
  thresholds?: ThresholdsConfig;
  thresholdsType?: GraphTresholdsStyleMode;
  onThresholdsChange?: (thresholds: ThresholdsConfig) => void;
}

/** The VizWrapper is just a simple component that renders either a table or a graph based on the type of data we receive from "PanelData" */
export const VizWrapper = ({ data, thresholds, thresholdsType }: Props) => {
  const styles = useStyles2(getStyles);
  const isTimeSeriesData = isTimeSeriesFrames(data.series);
  // const thresholdsStyle = thresholdsType ? { mode: thresholdsType } : undefined;

  return (
    <div className={styles.wrapper}>
      <AutoSizer disableHeight>
        {({ width }) => (
          <div style={{ width }}>
            {isTimeSeriesData ? (
              <GraphContainer
                loading={data.state === LoadingState.Loading}
                data={data.series}
                eventBus={appEvents}
                height={300}
                width={width}
                // @ts-ignore
                absoluteRange={data.timeRange as unknown as AbsoluteTimeRange}
                timeZone="browser"
                onChangeTime={() => { }}
                splitOpenFn={() => { }}
                loadingState={data.state}
                thresholdsConfig={thresholds}
              />
            ) : (
              <RawPrometheusContainer
                showRawPrometheus={false} // TODO set to true
                exploreId={ExploreId.left}
                loading={data.state === LoadingState.Loading}
                tableResult={prepareTimeSeries(data.series)}
                width={width}
                range={data.timeRange}
                timeZone="browser"
                splitOpenFn={() => { }}
              />
            )}
          </div>
        )}
      </AutoSizer>
    </div>
  );
};

/*
  The eval endpoint returns a dataframe for each "alert instance" that would be generated
  This is not very friendly to show in a table so we're converting multiple data frames to
  a single data frame with multiple fields

    Fields:

    Time | <Label> | <Label> | Value
    []   | []      | []      | []
*/
function prepareTimeSeries(series: DataFrame[]): DataFrame[] {
  return toTimeSeriesMulti(series)
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    width: 100%;
    position: relative;
  `,
});
