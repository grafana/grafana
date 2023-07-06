import { css } from '@emotion/css';
import { inRange } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useWindowSize } from 'react-use';

import { ErrorBoundaryAlert } from '@grafana/ui';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch, useSelector } from 'app/types';
import { ExploreQueryParams } from 'app/types/explore';

import { ExploreActions } from './ExploreActions';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import { useExplorePageTitle } from './hooks/useExplorePageTitle';
import { useStateSync } from './hooks/useStateSync';
import { useTimeSrvFix } from './hooks/useTimeSrvFix';
import { splitSizeUpdateAction } from './state/main';
import { isSplit, selectPanesEntries } from './state/selectors';

const styles = {
  pageScrollbarWrapper: css`
    width: 100%;
    flex-grow: 1;
    min-height: 0;
    height: 100%;
    position: relative;
  `,
};

export default function ExplorePage(props: GrafanaRouteComponentProps<{}, ExploreQueryParams>) {
  useTimeSrvFix();
  useStateSync(props.queryParams);
  // We want  to set the title according to the URL and not to the state because the URL itself may lag
  // (due to how useStateSync above works) by a few milliseconds.
  // When a URL is pushed to the history, the browser also saves the title of the page and
  // if we were to update the URL on state change, the title would not match the URL.
  // Ultimately the URL is the single source of truth from which state is derived, the page title is not different
  useExplorePageTitle(props.queryParams);
  const dispatch = useDispatch();
  const { keybindings, chrome } = useGrafana();
  const navModel = useNavModel('explore');
  const [rightPaneWidthRatio, setRightPaneWidthRatio] = useState(0.5);
  const { width: windowWidth } = useWindowSize();
  const minWidth = 200;
  const exploreState = useSelector((state) => state.explore);

  const panes = useSelector(selectPanesEntries);
  const hasSplit = useSelector(isSplit);

  useEffect(() => {
    //This is needed for breadcrumbs and topnav.
    //We should probably abstract this out at some point
    chrome.update({ sectionNav: navModel });
  }, [chrome, navModel]);

  useEffect(() => {
    keybindings.setupTimeRangeBindings(false);
  }, [keybindings]);

  const updateSplitSize = (size: number) => {
    const evenSplitWidth = windowWidth / 2;
    const areBothSimilar = inRange(size, evenSplitWidth - 100, evenSplitWidth + 100);
    if (areBothSimilar) {
      dispatch(splitSizeUpdateAction({ largerExploreId: undefined }));
    } else {
      dispatch(
        splitSizeUpdateAction({
          largerExploreId: size > evenSplitWidth ? panes[1][0] : panes[0][0],
        })
      );
    }

    setRightPaneWidthRatio(size / windowWidth);
  };

  let widthCalc = 0;
  if (hasSplit) {
    if (!exploreState.evenSplitPanes && exploreState.maxedExploreId) {
      widthCalc = exploreState.maxedExploreId === panes[1][0] ? windowWidth - minWidth : minWidth;
    } else if (exploreState.evenSplitPanes) {
      widthCalc = Math.floor(windowWidth / 2);
    } else if (rightPaneWidthRatio !== undefined) {
      widthCalc = windowWidth * rightPaneWidthRatio;
    }
  }

  return (
    <div className={styles.pageScrollbarWrapper}>
      <ExploreActions />

      <SplitPaneWrapper
        splitOrientation="vertical"
        paneSize={widthCalc}
        minSize={minWidth}
        maxSize={minWidth * -1}
        primary="second"
        splitVisible={hasSplit}
        paneStyle={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}
        onDragFinished={(size) => size && updateSplitSize(size)}
      >
        {panes.map(([exploreId]) => {
          return (
            <ErrorBoundaryAlert key={exploreId} style="page">
              <ExplorePaneContainer exploreId={exploreId} />
            </ErrorBoundaryAlert>
          );
        })}
      </SplitPaneWrapper>
    </div>
  );
}
