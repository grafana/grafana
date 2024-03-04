import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ErrorBoundaryAlert, useStyles2, useTheme2 } from '@grafana/ui';
import { AppChromeUpdate } from 'app/core/components/AppChrome/AppChromeUpdate';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useSelector } from 'app/types';
import { ExploreQueryParams } from 'app/types/explore';

import { CorrelationEditorModeBar } from './CorrelationEditorModeBar';
import { ExploreActions } from './ExploreActions';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import { ShortLinkButtonMenu } from './ShortLinkButtonMenu';
import { useExplorePageTitle } from './hooks/useExplorePageTitle';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSplitSizeUpdater } from './hooks/useSplitSizeUpdater';
import { useStateSync } from './hooks/useStateSync';
import { useTimeSrvFix } from './hooks/useTimeSrvFix';
import { isSplit, selectCorrelationDetails, selectPanesEntries } from './state/selectors';
import { ExploreWorkspacesMenu } from './workspaces/components/ExploreWorkspacesMenu';

const MIN_PANE_WIDTH = 200;

type ExplorePageParams = {
  workspace: string;
  snapshot: string;
};

export default function ExplorePage(props: GrafanaRouteComponentProps<ExplorePageParams, ExploreQueryParams>) {
  const styles = useStyles2(getStyles);

  const snapshot = props.match.params.snapshot;
  const workspace = props.match.params.workspace;

  const theme = useTheme2();
  useTimeSrvFix();

  const { currentState, loadedWorkspace, loadedSnapshot } = useStateSync(props.queryParams, workspace, snapshot);

  // We want  to set the title according to the URL and not to the state because the URL itself may lag
  // (due to how useStateSync above works) by a few milliseconds.
  // When a URL is pushed to the history, the browser also saves the title of the page and
  // if we were to update the URL on state change, the title would not match the URL.
  // Ultimately the URL is the single source of truth from which state is derived, the page title is not different
  useExplorePageTitle(props.queryParams, loadedWorkspace, loadedSnapshot);
  const { chrome } = useGrafana();
  const navModel = useNavModel('explore');
  const { updateSplitSize, widthCalc } = useSplitSizeUpdater(MIN_PANE_WIDTH);

  const panes = useSelector(selectPanesEntries);
  const hasSplit = useSelector(isSplit);
  const correlationDetails = useSelector(selectCorrelationDetails);
  const showCorrelationEditorBar = config.featureToggles.correlations && (correlationDetails?.editorMode || false);

  useEffect(() => {
    //This is needed for breadcrumbs and topnav.
    //We should probably abstract this out at some point
    chrome.update({ sectionNav: navModel });
  }, [chrome, navModel]);

  useKeyboardShortcuts();

  const navBarActions = [
    <ShortLinkButtonMenu key="share" />,
    <div style={{ flex: 1 }} key="spacer0" />,
    <ExploreWorkspacesMenu
      key="exploreWorkspacesMenu"
      currentState={currentState}
      loadedWorkspace={loadedWorkspace}
      loadedSnapshot={loadedSnapshot}
    />,
  ];

  return (
    <div
      className={cx(styles.pageScrollbarWrapper, {
        [styles.correlationsEditorIndicator]: showCorrelationEditorBar,
      })}
    >
      <div>
        <AppChromeUpdate actions={navBarActions} />
      </div>
      <ExploreActions />
      {showCorrelationEditorBar && <CorrelationEditorModeBar panes={panes} />}
      <SplitPaneWrapper
        splitOrientation="vertical"
        paneSize={widthCalc}
        minSize={MIN_PANE_WIDTH}
        maxSize={MIN_PANE_WIDTH * -1}
        primary="second"
        splitVisible={hasSplit}
        parentStyle={showCorrelationEditorBar ? { height: `calc(100% - ${theme.spacing(6)}` } : {}} // button = 4, padding = 1 x 2
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
    pageScrollbarWrapper: css({
      width: '100%',
      flexGrow: 1,
      minHeight: 0,
      height: '100%',
      position: 'relative',
    }),
    correlationsEditorIndicator: css({
      borderLeft: `4px solid ${theme.colors.primary.main}`,
      borderRight: `4px solid ${theme.colors.primary.main}`,
      borderBottom: `4px solid ${theme.colors.primary.main}`,
      overflow: 'scroll',
    }),
  };
};
