import { css } from '@emotion/css';
import React, { RefObject, useMemo, useState } from 'react';

import { DataFrame, SplitOpen, PanelData, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { StoreState, useSelector } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { TraceView } from './TraceView';
import TracePageSearchBar from './components/TracePageHeader/TracePageSearchBar';
import { TopOfViewRefType } from './components/TraceTimelineViewer/VirtualizedTraceView';
import { useSearch } from './useSearch';
import { transformDataFrames } from './utils/transform';
interface Props {
  dataFrames: DataFrame[];
  splitOpenFn: SplitOpen;
  exploreId: ExploreId;
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
    padding: ${config.featureToggles.newTraceView ? 0 : theme.spacing(theme.components.panel.padding)};
  `,
});

export function TraceViewContainer(props: Props) {
  // At this point we only show single trace
  const frame = props.dataFrames[0];
  const style = useStyles2(getStyles);
  const { dataFrames, splitOpenFn, exploreId, scrollElement, topOfViewRef, queryResponse } = props;
  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);
  const [showMatchesOnly, setMatchesOnly] = useState(false);
  const [focusedSpanIdForSearch, setFocusedSpanIdForSearch] = useState('');
  const [searchBarSuffix, setSearchBarSuffix] = useState('');
  const datasource = useSelector(
    (state: StoreState) => state.explore[props.exploreId!]?.datasourceInstance ?? undefined
  );
  const datasourceType = datasource ? datasource?.type : 'unknown';

  if (!traceProp) {
    return null;
  }

  return (
    <div className={style.container}>
      {!config.featureToggles.newTraceView && (
        <TracePageSearchBar
          navigable={true}
          searchValue={search}
          setSearch={setSearch}
          showMatchesOnly={showMatchesOnly}
          setMatchesOnly={setMatchesOnly}
          spanFindMatches={spanFindMatches}
          searchBarSuffix={searchBarSuffix}
          setSearchBarSuffix={setSearchBarSuffix}
          focusedSpanIdForSearch={focusedSpanIdForSearch}
          setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
          datasourceType={datasourceType}
        />
      )}
      <TraceView
        exploreId={exploreId}
        dataFrames={dataFrames}
        splitOpenFn={splitOpenFn}
        scrollElement={scrollElement}
        traceProp={traceProp}
        spanFindMatches={spanFindMatches}
        showMatchesOnly={showMatchesOnly}
        search={search}
        focusedSpanIdForSearch={focusedSpanIdForSearch}
        queryResponse={queryResponse}
        datasource={datasource}
        topOfViewRef={topOfViewRef}
        topOfViewRefType={TopOfViewRefType.Explore}
      />
    </div>
  );
}
