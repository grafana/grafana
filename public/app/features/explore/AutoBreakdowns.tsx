import React from 'react';
import { Collapse } from '@grafana/ui';
import { AbsoluteTimeRange, LoadingState, TimeZone, DataFrame, DataSourceApi } from '@grafana/data';
import { ExploreGraph } from './ExploreGraph';

export interface Props {
  timeZone: TimeZone;
  graphStyle: any;
  datasourceInstance?: DataSourceApi | null;
  autoBreakdownRange?: AbsoluteTimeRange;
}

export const AutoBreakdowns = (props: Props) => {
  const { datasourceInstance, graphStyle, autoBreakdownRange, timeZone } = props;
  if (!datasourceInstance || !autoBreakdownRange) {
    return null;
  }
  //@ts-ignore
  const dataFrames = datasourceInstance?.createAutoBreakdowns(autoBreakdownRange);

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {dataFrames.map((df: DataFrame) => {
        return (
          <div style={{ margin: '10px' }} key={`${df.name}`}>
            <Collapse label={`Auto breakdowns by ${df.name}`} isOpen>
              <ExploreGraph
                graphStyle={graphStyle}
                data={[df]}
                height={200}
                width={300}
                timeZone={timeZone}
                absoluteRange={autoBreakdownRange}
                loadingState={LoadingState.Done}
                onChangeTime={() => {}}
                pluginId="barchart"
              />
            </Collapse>
          </div>
        );
      })}
    </div>
  );
};
