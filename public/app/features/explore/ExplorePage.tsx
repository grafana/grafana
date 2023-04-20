import { css } from '@emotion/css';
import { inRange } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useWindowSize } from 'react-use';

import { locationService } from '@grafana/runtime';
import { ErrorBoundaryAlert } from '@grafana/ui';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { stopQueryState } from 'app/core/utils/explore';
import { useDispatch, useSelector } from 'app/types';
import { ExploreId, ExploreQueryParams } from 'app/types/explore';

import { ExploreActions } from './ExploreActions';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import { useExploreCorrelations } from './hooks/useExploreCorrelations';
import { useExplorePageTitle } from './hooks/useExplorePageTitle';
import { useStateSync } from './hooks/useStateSync';
import { useURLSync } from './hooks/useURLSync';
import { splitSizeUpdateAction } from './state/main';

const styles = {
  pageScrollbarWrapper: css`
    width: 100%;
    flex-grow: 1;
    min-height: 0;
    height: 100%;
    position: relative;
  `,
};

export function ExplorePage(props: GrafanaRouteComponentProps<{}, ExploreQueryParams>) {
  useStateSync(props.queryParams);
  useURLSync();
  // FIXME: This should happen as part of URL changes, or at least only after URL has changed
  useExplorePageTitle();
  useExploreCorrelations();
  const dispatch = useDispatch();
  const { keybindings, chrome } = useGrafana();
  const navModel = useNavModel('explore');
  const [rightPaneWidthRatio, setRightPaneWidthRatio] = useState(0.5);
  const { width: windowWidth } = useWindowSize();
  const minWidth = 200;
  const exploreState = useSelector((state) => state.explore);

  const panes = useSelector((state) => state.explore.panes);

  useEffect(() => {
    //This is needed for breadcrumbs and topnav.
    //We should probably abstract this out at some point
    chrome.update({ sectionNav: navModel });
  }, [chrome, navModel]);

  useEffect(() => {
    keybindings.setupTimeRangeBindings(false);
  }, [keybindings]);

  useEffect(() => {
    // timeSrv (which is used internally) on init reads `from` and `to` param from the URL and updates itself
    // using those value regardless of what is passed to the init method.
    // The updated value is then used by Explore to get the range for each pane.
    // This means that if `from` and `to` parameters are present in the URL,
    // it would be impossible to change the time range in Explore.
    // We are only doing this on mount for 2 reasons:
    // 1: Doing it on update means we'll enter a render loop.
    // 2: when parsing time in Explore (before feeding it to timeSrv) we make sure `from` is before `to` inside
    //    each pane state in order to not trigger un URL update from timeSrv.
    const searchParams = locationService.getSearchObject();
    if (searchParams.from || searchParams.to) {
      locationService.partial({ from: undefined, to: undefined }, true);
    }

    return () => {
      for (const [, pane] of Object.entries(panes)) {
        stopQueryState(pane!.querySubscription);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch is stable, doesn't need to be in the deps array
  }, []);

  const updateSplitSize = (size: number) => {
    const evenSplitWidth = windowWidth / 2;
    const areBothSimilar = inRange(size, evenSplitWidth - 100, evenSplitWidth + 100);
    if (areBothSimilar) {
      dispatch(splitSizeUpdateAction({ largerExploreId: undefined }));
    } else {
      dispatch(
        splitSizeUpdateAction({
          largerExploreId: size > evenSplitWidth ? ExploreId.right : ExploreId.left,
        })
      );
    }

    setRightPaneWidthRatio(size / windowWidth);
  };

  const hasSplit = Object.entries(panes).length > 1;
  let widthCalc = 0;
  if (hasSplit) {
    if (!exploreState.evenSplitPanes && exploreState.maxedExploreId) {
      widthCalc = exploreState.maxedExploreId === ExploreId.right ? windowWidth - minWidth : minWidth;
    } else if (exploreState.evenSplitPanes) {
      widthCalc = Math.floor(windowWidth / 2);
    } else if (rightPaneWidthRatio !== undefined) {
      widthCalc = windowWidth * rightPaneWidthRatio;
    }
  }

  return (
    <div className={styles.pageScrollbarWrapper}>
      <ExploreActions exploreIdLeft={ExploreId.left} exploreIdRight={ExploreId.right} />

      <SplitPaneWrapper
        splitOrientation="vertical"
        paneSize={widthCalc}
        minSize={minWidth}
        maxSize={minWidth * -1}
        primary="second"
        splitVisible={hasSplit}
        paneStyle={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}
        onDragFinished={(size) => {
          if (size) {
            updateSplitSize(size);
          }
        }}
      >
        {Object.keys(panes).map((exploreId) => {
          return (
            <ErrorBoundaryAlert key={exploreId} style="page">
              <ExplorePaneContainer exploreId={exploreId as ExploreId} />
            </ErrorBoundaryAlert>
          );
        })}
      </SplitPaneWrapper>
    </div>
  );
}
