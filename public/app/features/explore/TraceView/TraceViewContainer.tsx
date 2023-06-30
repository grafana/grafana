import { css } from '@emotion/css';
import React, { RefObject, useMemo, useState } from 'react';

import { CoreApp, DataFrame, GrafanaTheme2, PanelData, SplitOpen } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { PanelChrome } from '@grafana/ui/src/components/PanelChrome/PanelChrome';
import { StoreState, useSelector } from 'app/types';

import { TraceView } from './TraceView';
import TracePageActions from './components/TracePageHeader/Actions/TracePageActions';
import TracePageSearchBar from './components/TracePageHeader/TracePageSearchBar';
import { TopOfViewRefType } from './components/TraceTimelineViewer/VirtualizedTraceView';
import ExternalLinks from './components/common/ExternalLinks';
import { getTraceLinks } from './components/model/link-patterns';
import { getTraceName } from './components/model/trace-viewer';
import { formatDuration } from './components/utils/date';
import { useSearch } from './useSearch';
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
  duration: css({
    color: '#aaa',
    ...theme.typography.bodySmall,
    alignSelf: 'center',
  }),
});

export function TraceViewContainer(props: Props) {
  // At this point we only show single trace
  const frame = props.dataFrames[0];
  const style = useStyles2(getStyles);
  const { dataFrames, splitOpenFn, exploreId, scrollElement, topOfViewRef, queryResponse } = props;
  const traceProp = useMemo(() => transformDataFrames(frame), [frame]);
  const { search, setSearch, spanFindMatches } = useSearch(traceProp?.spans);
  const [focusedSpanIdForSearch, setFocusedSpanIdForSearch] = useState('');
  const [searchBarSuffix, setSearchBarSuffix] = useState('');
  const datasource = useSelector(
    (state: StoreState) => state.explore.panes[props.exploreId]?.datasourceInstance ?? undefined
  );
  const datasourceType = datasource ? datasource?.type : 'unknown';

  const links = useMemo(() => {
    if (!traceProp) {
      return [];
    }
    return getTraceLinks(traceProp);
  }, [traceProp]);

  if (!traceProp) {
    return null;
  }

  return (
    <PanelChrome
      padding="none"
      title={getTraceName(traceProp.spans)} // name it just "Trace" or use {getTraceName(traceProp.spans)} - but inside the component itself
      titleItems={
        <span className={style.duration}>
          {config.featureToggles.newTraceViewHeader ? (
            <>
              {formatDuration(traceProp.duration)}
              {links && links.length > 0 && <ExternalLinks links={links} />}
            </>
          ) : (
            traceProp.traceID
          )}
          {!config.featureToggles.newTraceViewHeader && links && links.length > 0 && <ExternalLinks links={links} />}
        </span>
      }
      actions={
        config.featureToggles.newTraceViewHeader ? (
          <TracePageActions
            traceId={traceProp.traceID}
            data={dataFrames[0]}
            app={exploreId ? CoreApp.Explore : CoreApp.Unknown}
          />
        ) : (
          <TracePageSearchBar
            navigable={true}
            searchValue={search}
            setSearch={setSearch}
            spanFindMatches={spanFindMatches}
            searchBarSuffix={searchBarSuffix}
            setSearchBarSuffix={setSearchBarSuffix}
            focusedSpanIdForSearch={focusedSpanIdForSearch}
            setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
            datasourceType={datasourceType}
          />
        )
      }
    >
      <TraceView
        exploreId={exploreId}
        dataFrames={dataFrames}
        splitOpenFn={splitOpenFn}
        scrollElement={scrollElement}
        traceProp={traceProp}
        spanFindMatches={spanFindMatches}
        search={search}
        focusedSpanIdForSearch={focusedSpanIdForSearch}
        queryResponse={queryResponse}
        datasource={datasource}
        topOfViewRef={topOfViewRef}
        topOfViewRefType={TopOfViewRefType.Explore}
      />
    </PanelChrome>
  );
}
