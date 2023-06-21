import { css } from '@emotion/css';
import cx from 'classnames';
import React, { RefObject, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrame, SplitOpen, PanelData, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { PanelChrome } from '@grafana/ui/src/components/PanelChrome/PanelChrome';
import { StoreState, useSelector } from 'app/types';
import { ExploreId } from 'app/types/explore';

import { TraceView } from './TraceView';
import TracePageSearchBar from './components/TracePageHeader/TracePageSearchBar';
import { TopOfViewRefType } from './components/TraceTimelineViewer/VirtualizedTraceView';
import ExternalLinks from './components/common/ExternalLinks';
import TraceName from './components/common/TraceName';
import { autoColor } from './components/index';
import { getTraceLinks } from './components/model/link-patterns';
import { getTraceName } from './components/model/trace-viewer';
import { uTxMuted } from './components/uberUtilityStyles';
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
    padding: ${true ? 0 : theme.spacing(theme.components.panel.padding)};
  `,
  // TODO: put this into the component - see what's in titleWithLinks prop below
  tracePageHeaderTitleRow: css`
    label: tracePageHeaderTitleRow;
    align-items: center;
    display: flex;
    margin-top: ${theme.spacing(1)};
  `,
  tracePageHeaderBack: css`
    label: tracePageHeaderBack;
    align-items: center;
    align-self: stretch;
    background-color: #fafafa;
    border-bottom: 1px solid #ddd;
    border-right: 1px solid #ddd;
    color: inherit;
    display: flex;
    font-size: 1.4rem;
    padding: 0 1rem;
    margin-bottom: -1px;
    &:hover {
      background-color: #f0f0f0;
      border-color: #ccc;
    }
  `,
  tracePageHeaderTitle: css`
    label: TracePageHeaderTitle;
    color: inherit;
    flex: 1;
    font-size: 1.7em;
    line-height: 1em;
    margin: 0 0 0 0.3em;
    padding-bottom: 0.5em;
  `,
  tracePageHeaderTraceId: css`
    label: TracePageHeaderTraceId;
    white-space: nowrap;
  `,
  titleBorderBottom: css`
    border-bottom: 1px solid ${autoColor(theme, '#e8e8e8')};
  `,
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
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  const links = React.useMemo(() => {
    if (!traceProp) {
      return [];
    }
    return getTraceLinks(traceProp);
  }, [traceProp]);

  if (!traceProp) {
    return null;
  }

  // TODO: remove this once we figure out where links button should be placed
  const testLinks = [
    {
      url: 'https://www.google.com',
      text: 'Google',
    },
    {
      url: 'https://www.google.com',
      text: 'Facebook',
    },
    {
      url: 'https://www.google.com',
      text: 'Instagram',
    },
  ];

  if (!traceProp) {
    return null;
  }

  return (
    <div className={style.container} ref={ref}>
      <PanelChrome
        padding="none"
        width={width}
        titleWithLinks={
          // TODO: This should be a component - what we pass here will be determined by config.featureToggles.newTraceViewHeader
          <div className={cx(style.tracePageHeaderTitleRow, style.titleBorderBottom)}>
            {links && links.length > 0 && <ExternalLinks links={links} className={style.tracePageHeaderBack} />}
            <h1 className={style.tracePageHeaderTitle}>
              <TraceName traceName={getTraceName(traceProp.spans)} />{' '}
              <small className={cx(style.tracePageHeaderTraceId, uTxMuted)}>{traceProp.traceID}</small>
            </h1>
          </div>
        }
        displayMode="transparent"
      >
        {() => (
          <>
            {!config.featureToggles.newTraceViewHeader && (
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
            )}
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
          </>
        )}
      </PanelChrome>
    </div>
  );
}
