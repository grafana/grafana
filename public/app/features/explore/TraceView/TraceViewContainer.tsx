import { css } from '@emotion/css';
import { useMemo } from 'react';

import { DataFrame, DataLinksContext, SplitOpen, TimeRange } from '@grafana/data';
import { t } from '@grafana/i18n';
import { PanelChrome, useStyles2 } from '@grafana/ui';
import { StoreState, useSelector } from 'app/types/store';

import { useExploreDataLinkPostProcessor } from '../hooks/useExploreDataLinkPostProcessor';

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
  const styles = useStyles2(getStyles);
  const dataLinkPostProcessor = useExploreDataLinkPostProcessor(splitOpenFn, timeRange);

  if (!traceProp) {
    return null;
  }

  return (
    <div className={styles.container}>
      <PanelChrome padding="none" title={t('explore.trace-view-container.title-trace', 'Trace')}>
        <DataLinksContext.Provider value={{ dataLinkPostProcessor }}>
          <TraceView
            exploreId={exploreId}
            dataFrames={dataFrames}
            splitOpenFn={splitOpenFn}
            scrollElement={scrollElement}
            traceProp={traceProp}
            datasource={datasource}
            timeRange={timeRange}
          />
        </DataLinksContext.Provider>
      </PanelChrome>
    </div>
  );
}

const getStyles = () => {
  return {
    container: css({
      '& > section': {
        /* 
        The PanelChrome component sets the overflow property, which prevents the Trace View header from 
        being sticky by creating a new scrolling ancestor.
        This is a workaround to allow the header to be sticky.
        */
        overflow: 'initial',
      },
    }),
  };
};
