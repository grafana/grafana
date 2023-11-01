import React, { useMemo } from 'react';

import { DataFrame, SplitOpen, DataQueryRequest } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { PanelChrome } from '@grafana/ui/src/components/PanelChrome/PanelChrome';
import { StoreState, useSelector } from 'app/types';

import { TraceView } from './TraceView';
import { transformDataFrames } from './utils/transform';

interface Props {
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: string;
  scrollElement?: Element;
  request: DataQueryRequest<DataQuery> | undefined;
}

export function TraceViewContainer(props: Props) {
  // At this point we only show single trace
  const frame = props.dataFrames[0];
  const { dataFrames, splitOpenFn, exploreId, scrollElement, request } = props;
  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const datasource = useSelector(
    (state: StoreState) => state.explore.panes[props.exploreId]?.datasourceInstance ?? undefined
  );

  if (!traceProp) {
    return null;
  }

  return (
    <PanelChrome padding="none" title="Trace">
      <TraceView
        exploreId={exploreId}
        dataFrames={dataFrames}
        splitOpenFn={splitOpenFn}
        scrollElement={scrollElement}
        traceProp={traceProp}
        request={request}
        datasource={datasource}
      />
    </PanelChrome>
  );
}
