import { css } from '@emotion/css';
import appEvents from 'app/core/app_events';
import React from 'react';

import { AbsoluteTimeRange, DataFrame, GrafanaTheme2, isTimeSeriesFrames, PanelData, ThresholdsConfig } from '@grafana/data';
import { GraphTresholdsStyleMode, LoadingState } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';

import { GraphContainer } from 'app/features/explore/Graph/GraphContainer';
import { RawPrometheusContainer } from 'app/features/explore/RawPrometheusContainer';
import { ExploreId } from 'app/types/explore';
import { PrepareTimeSeriesOptions, prepareTimeSeriesTransformer, timeSeriesFormat } from 'app/features/transformers/prepareTimeSeries/prepareTimeSeries';

interface Props {
  data: PanelData;
  thresholds?: ThresholdsConfig;
  thresholdsType?: GraphTresholdsStyleMode;
  onThresholdsChange?: (thresholds: ThresholdsConfig) => void;
}

/** The VizWrapper is just a simple component that renders either a table or a graph based on the type of data we receive from "PanelData" */
export const VizWrapper = ({ data, thresholds, thresholdsType = GraphTresholdsStyleMode.Line }: Props) => {
  const styles = useStyles2(getStyles);

  console.log(data)
  const isTimeSeriesData = isTimeSeriesFrames(data.series)

  return (
    <div className={styles.wrapper}>
      {isTimeSeriesData ? (
        <GraphContainer
          loading={data.state === LoadingState.Loading}
          data={data.series}
          eventBus={appEvents}
          height={200}
          width={800}
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
          width={800}
          range={data.timeRange}
          timeZone="browser"
          splitOpenFn={() => { }}
        />
      )}
    </div>
  );
};

/**
 The eval endpoint returns a dataframe for each "alert instance" that would be generated
 This is not very friendly to show in a table so we're converting multiple data frames to
 a single data frame with multiple fields

    Fields:

    Time | <Label> | <Label> | Value
    []   | []      | []      | []

*/
function prepareTimeSeries(series: DataFrame[]): DataFrame[] {
  return series
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css``,
});
