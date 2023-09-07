import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ErrorBoundaryAlert, useStyles2 } from '@grafana/ui';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch, useSelector } from 'app/types';
import { ExploreQueryParams } from 'app/types/explore';

import { CorrelationEditorModeBar } from './CorrelationEditorModeBar';
import { ExploreActions } from './ExploreActions';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import { useExplorePageTitle } from './hooks/useExplorePageTitle';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSplitSizeUpdater } from './hooks/useSplitSizeUpdater';
import { useStateSync } from './hooks/useStateSync';
import { useTimeSrvFix } from './hooks/useTimeSrvFix';
import { changeCorrelationEditorMode } from './state/main';
import { isSplit, selectCorrelationDetails, selectCorrelationEditorMode, selectPanesEntries } from './state/selectors';

const MIN_PANE_WIDTH = 200;

export default function ExplorePage(props: GrafanaRouteComponentProps<{}, ExploreQueryParams>) {
  const styles = useStyles2(getStyles);
  useTimeSrvFix();
  useStateSync(props.queryParams);
  // We want  to set the title according to the URL and not to the state because the URL itself may lag
  // (due to how useStateSync above works) by a few milliseconds.
  // When a URL is pushed to the history, the browser also saves the title of the page and
  // if we were to update the URL on state change, the title would not match the URL.
  // Ultimately the URL is the single source of truth from which state is derived, the page title is not different
  useExplorePageTitle(props.queryParams);
  const { chrome } = useGrafana();
  const navModel = useNavModel('explore');
  const dispatch = useDispatch();
  const { updateSplitSize, widthCalc } = useSplitSizeUpdater(MIN_PANE_WIDTH);

  const panes = useSelector(selectPanesEntries);
  const hasSplit = useSelector(isSplit);
  const isCorrelationsEditorMode = useSelector(selectCorrelationEditorMode);
  const correlationDetails = useSelector(selectCorrelationDetails);
  // show correlation editor mode UX elements if we are in the editor mode or if we are trying to exit in a dirty state
  const showCorrelationEditorMode = isCorrelationsEditorMode || (!isCorrelationsEditorMode && correlationDetails?.dirty) || false;

  useEffect(() => {
    //This is needed for breadcrumbs and topnav.
    //We should probably abstract this out at some point
    chrome.update({ sectionNav: navModel });
  }, [chrome, navModel]);

  useEffect(() => {
    if (showCorrelationEditorMode) {
      const exploreNavItem = { ...navModel.node };
      exploreNavItem.text = 'Correlations Editor';
      exploreNavItem.parentItem = navModel.node;
      exploreNavItem.parentItem.url = undefined;
      exploreNavItem.parentItem.onClick = () => {
        dispatch(changeCorrelationEditorMode({ correlationEditorMode: false }));
      };
      navModel.node = exploreNavItem;
      chrome.update({ sectionNav: navModel });
    }
  }, [chrome, showCorrelationEditorMode, navModel, dispatch, panes]);

  useKeyboardShortcuts();

  return (
    <div
      className={cx(styles.pageScrollbarWrapper, {
        [styles.correlationsEditorIndicator]: showCorrelationEditorMode,
      })}
    >
      <ExploreActions />
      {config.featureToggles.correlations  && <CorrelationEditorModeBar panes={panes} toShow={showCorrelationEditorMode}/>}
      <SplitPaneWrapper
        splitOrientation="vertical"
        paneSize={widthCalc}
        minSize={MIN_PANE_WIDTH}
        maxSize={MIN_PANE_WIDTH * -1}
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    pageScrollbarWrapper: css`
      width: 100%;
      flex-grow: 1;
      min-height: 0;
      height: 100%;
      position: relative;
    `,
    correlationsEditorIndicator: css`
      border-left: 4px solid ${theme.colors.primary.main};
      border-right: 4px solid ${theme.colors.primary.main};
      border-bottom: 4px solid ${theme.colors.primary.main};
      overflow: scroll;
    `,
    correlationEditorTop: css`
      background-color: ${theme.colors.primary.main};
      margin-top: 3px;
    `,
  };
};
