import React from 'react';
import { Collapse } from '@grafana/ui';
import { DataFrame, DataSourceApi, SplitOpen } from '@grafana/data';
import { TraceView } from './TraceView';
import { ExploreId } from 'app/types/explore';

interface Props {
  datasource: DataSourceApi;
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: ExploreId;
  scrollElement?: Element;
}
export function TraceViewContainer(props: Props) {
  const { dataFrames, splitOpenFn, exploreId, scrollElement, datasource } = props;

  return (
    <Collapse label="Trace View" isOpen>
      <TraceView
        datasource={datasource}
        exploreId={exploreId}
        dataFrames={dataFrames}
        splitOpenFn={splitOpenFn}
        scrollElement={scrollElement}
      />
    </Collapse>
  );
}
