import React from 'react';
import { css } from '@emotion/css';
import { Collapse } from '@grafana/ui';
import { AbsoluteTimeRange, LoadingState, TimeZone, DataFrame, DataSourceApi } from '@grafana/data';
import { ExploreGraph } from './ExploreGraph';
export interface Props {
  timeZone: TimeZone;
  datasourceInstance?: DataSourceApi | null;
  autoBreakdownRange?: AbsoluteTimeRange;
  autoBreakdownValues?: { min: number; max: number };
  absoluteRange: AbsoluteTimeRange;
}

const spacing = css({
  marginRight: '10px',
  marginBottom: '10px',
});

function calcWidth(df: DataFrame): number {
  const baseWidth = 300;
  const margin = 10;
  const panelPadding = 8;
  const panelBorder = 1;
  return df.length <= 8 ? baseWidth : 2 * baseWidth + margin + 2 * panelPadding + 2 * panelBorder;
}

export const AutoBreakdowns = (props: Props) => {
  const { datasourceInstance, autoBreakdownRange, timeZone, absoluteRange, autoBreakdownValues } = props;
  if (!datasourceInstance) {
    return null;
  }

  let dataFrames;
  //@ts-ignore
  if (datasourceInstance?.createAutoBreakdowns) {
    //@ts-ignore
    dataFrames = datasourceInstance?.createAutoBreakdowns(autoBreakdownRange, autoBreakdownValues);
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {dataFrames.map((df: DataFrame) => {
        return (
          <div className={spacing} key={`${df.name}`}>
            <Collapse label={`Breakdown: ${df.name}`} isOpen>
              <ExploreGraph
                graphStyle="bars"
                data={[df]}
                height={150}
                width={calcWidth(df)}
                timeZone={timeZone}
                absoluteRange={absoluteRange}
                loadingState={LoadingState.Done}
                onChangeTime={() => {}}
                showLegend={false}
                pluginId="barchart"
              />
            </Collapse>
          </div>
        );
      })}
    </div>
  );
};
