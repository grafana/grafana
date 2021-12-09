import React from 'react';
import { css } from '@emotion/css';
import { Collapse } from '@grafana/ui';
import { AbsoluteTimeRange, LoadingState, TimeZone, DataFrame, DataSourceApi, GrafanaTheme2 } from '@grafana/data';
import { ExploreGraph } from './ExploreGraph';
import { EXPLORE_GRAPH_STYLES } from 'app/core/utils/explore';

export interface Props {
  timeZone: TimeZone;
  graphStyle: any;
  datasourceInstance?: DataSourceApi | null;
  autoBreakdownRange?: AbsoluteTimeRange;
}

const spacing = css({
  marginRight: '10px',
  marginBottom: '10px',
});

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
          <div className={spacing} key={`${df.name}`}>
            <Collapse label={`Auto breakdowns by ${df.name}`} isOpen>
              <ExploreGraph
                graphStyle="bars"
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
