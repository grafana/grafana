import { useMemo } from 'react';

import { DataFrame, SplitOpen, TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelChrome } from '@grafana/ui';
import { StoreState, useSelector } from 'app/types/store';

import { TraceView } from './TraceView';
import { transformDataFrames } from './utils/transform';

interface Props {
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: string;
  scrollElement?: Element;
  timeRange: TimeRange;
}

export function TraceViewContainer(props: Props) {
  // At this point we only show single trace
  const frame = props.dataFrames[0];
  const { dataFrames, splitOpenFn, exploreId, scrollElement, timeRange } = props;
  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const datasource = useSelector(
    (state: StoreState) => state.explore.panes[props.exploreId]?.datasourceInstance ?? undefined
  );

  if (!traceProp) {
    return null;
  }

  return (
    <PanelChrome padding="none" title={t('explore.trace-view-container.title-trace', 'Trace')}>
      <TraceView
        exploreId={exploreId}
        dataFrames={dataFrames}
        splitOpenFn={splitOpenFn}
        scrollElement={scrollElement}
        traceProp={traceProp}
        datasource={datasource}
        timeRange={timeRange}
      />
    </PanelChrome>
  );
}
