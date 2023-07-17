import { css } from '@emotion/css';
import React, { RefObject, useMemo } from 'react';

import { DataFrame, SplitOpen, PanelData, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { StoreState, useSelector } from 'app/types';

import { TraceView } from './TraceView';
import { TopOfViewRefType } from './components/TraceTimelineViewer/VirtualizedTraceView';
import { transformDataFrames } from './utils/transform';
interface Props {
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: string;
  scrollElement?: Element;
  queryResponse: PanelData;
  topOfViewRef: RefObject<HTMLDivElement>;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    label: container;
    margin-bottom: ${theme.spacing(1)};
    background-color: ${theme.colors.background.primary};
    border: 1px solid ${theme.colors.border.medium};
    position: relative;
    border-radius: ${theme.shape.radius.default};
    width: 100%;
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    padding: ${config.featureToggles.newTraceViewHeader ? 0 : theme.spacing(theme.components.panel.padding)};
  `,
});

export function TraceViewContainer(props: Props) {
  // At this point we only show single trace
  const frame = props.dataFrames[0];
  const style = useStyles2(getStyles);
  const { dataFrames, splitOpenFn, exploreId, scrollElement, topOfViewRef, queryResponse } = props;
  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const datasource = useSelector(
    (state: StoreState) => state.explore.panes[props.exploreId]?.datasourceInstance ?? undefined
  );

  if (!traceProp) {
    return null;
  }

  return (
    <div className={style.container}>
      <TraceView
        exploreId={exploreId}
        dataFrames={dataFrames}
        splitOpenFn={splitOpenFn}
        scrollElement={scrollElement}
        traceProp={traceProp}
        queryResponse={queryResponse}
        datasource={datasource}
        topOfViewRef={topOfViewRef}
        topOfViewRefType={TopOfViewRefType.Explore}
      />
    </div>
  );
}
