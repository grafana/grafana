import { css } from '@emotion/css';
import { addListener } from '@reduxjs/toolkit';
import { inRange } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import { useWindowSize } from 'react-use';

import { isTruthy } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { ErrorBoundaryAlert, usePanelContext } from '@grafana/ui';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch, useSelector } from 'app/types';
import { ExploreId, ExploreQueryParams } from 'app/types/explore';

import { Branding } from '../../core/components/Branding/Branding';
import { useCorrelations } from '../correlations/useCorrelations';

import { ExploreActions } from './ExploreActions';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import { saveCorrelationsAction, resetExploreAction, splitSizeUpdateAction, stateSave } from './state/main';

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
  useExplorePageTitle();
  const dispatch = useDispatch();
  const queryParams = props.queryParams;
  const { keybindings, chrome, config } = useGrafana();
  const navModel = useNavModel('explore');
  const { get } = useCorrelations();
  const { warning } = useAppNotification();
  const panelCtx = usePanelContext();
  const eventBus = useRef(panelCtx.eventBus.newScopedBus('explore', { onlyLocal: false }));
  const [rightPaneWidthRatio, setRightPaneWidthRatio] = useState(0.5);
  const { width: windowWidth } = useWindowSize();
  const minWidth = 200;
  const exploreState = useSelector((state) => state.explore);

  useEffect(() => {
    //This is needed for breadcrumbs and topnav.
    //We should probably abstract this out at some point
    chrome.update({ sectionNav: navModel.node });
  }, [chrome, navModel]);

  useEffect(() => {
    keybindings.setupTimeRangeBindings(false);
  }, [keybindings]);

  useEffect(() => {
    if (!config.featureToggles.correlations) {
      dispatch(saveCorrelationsAction([]));
    } else {
      get.execute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (get.value) {
      dispatch(saveCorrelationsAction(get.value));
    } else if (get.error) {
      dispatch(saveCorrelationsAction([]));
      warning(
        'Could not load correlations.',
        'Correlations data could not be loaded, DataLinks may have partial data.'
      );
    }
  }, [get.value, get.error, dispatch, warning]);

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
      // Cleaning up Explore state so that when navigating back to Explore it starts from a blank state
      dispatch(resetExploreAction());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch is stable, doesn't need to be in the deps array
  }, []);

  useEffect(() => {
    const unsubscribe = dispatch(
      addListener({
        predicate: (action) => action.type.startsWith('explore'),
        effect: async (action, { dispatch, cancelActiveListeners, delay }) => {
          cancelActiveListeners();
          await delay(200);

          // TODO: here we centralize the logic for persisting back Explore's state to the URL.
          // TODO: skip if last action was cleanup (or we are outside of explore)
          console.log('Saving state ', action);

          dispatch(stateSave());
        },
      })
    );

    return unsubscribe;
  }, [dispatch]);

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

  const hasSplit = Boolean(queryParams.left) && Boolean(queryParams.right);
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
        <ErrorBoundaryAlert style="page">
          <ExplorePaneContainer exploreId={ExploreId.left} urlQuery={queryParams.left} eventBus={eventBus.current} />
        </ErrorBoundaryAlert>
        {hasSplit && (
          <ErrorBoundaryAlert style="page">
            <ExplorePaneContainer
              exploreId={ExploreId.right}
              urlQuery={queryParams.right}
              eventBus={eventBus.current}
            />
          </ErrorBoundaryAlert>
        )}
      </SplitPaneWrapper>
    </div>
  );
}

const useExplorePageTitle = () => {
  const navModel = useNavModel('explore');
  const datasources = useSelector((state) =>
    [state.explore.panes.left!.datasourceInstance?.name, state.explore.panes.right?.datasourceInstance?.name].filter(
      isTruthy
    )
  );

  document.title = `${navModel.main.text} - ${datasources.join(' | ')} - ${Branding.AppTitle}`;
};
