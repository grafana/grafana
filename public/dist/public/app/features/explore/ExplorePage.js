import { css, cx } from '@emotion/css';
import React, { useEffect } from 'react';
import { config } from '@grafana/runtime';
import { ErrorBoundaryAlert, useStyles2, useTheme2 } from '@grafana/ui';
import { SplitPaneWrapper } from 'app/core/components/SplitPaneWrapper/SplitPaneWrapper';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { useSelector } from 'app/types';
import { CorrelationEditorModeBar } from './CorrelationEditorModeBar';
import { ExploreActions } from './ExploreActions';
import { ExplorePaneContainer } from './ExplorePaneContainer';
import { useExplorePageTitle } from './hooks/useExplorePageTitle';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useSplitSizeUpdater } from './hooks/useSplitSizeUpdater';
import { useStateSync } from './hooks/useStateSync';
import { useTimeSrvFix } from './hooks/useTimeSrvFix';
import { isSplit, selectCorrelationDetails, selectPanesEntries } from './state/selectors';
const MIN_PANE_WIDTH = 200;
export default function ExplorePage(props) {
    const styles = useStyles2(getStyles);
    const theme = useTheme2();
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
    const { updateSplitSize, widthCalc } = useSplitSizeUpdater(MIN_PANE_WIDTH);
    const panes = useSelector(selectPanesEntries);
    const hasSplit = useSelector(isSplit);
    const correlationDetails = useSelector(selectCorrelationDetails);
    const showCorrelationEditorBar = config.featureToggles.correlations && ((correlationDetails === null || correlationDetails === void 0 ? void 0 : correlationDetails.editorMode) || false);
    useEffect(() => {
        //This is needed for breadcrumbs and topnav.
        //We should probably abstract this out at some point
        chrome.update({ sectionNav: navModel });
    }, [chrome, navModel]);
    useKeyboardShortcuts();
    return (React.createElement("div", { className: cx(styles.pageScrollbarWrapper, {
            [styles.correlationsEditorIndicator]: showCorrelationEditorBar,
        }) },
        React.createElement(ExploreActions, null),
        showCorrelationEditorBar && React.createElement(CorrelationEditorModeBar, { panes: panes }),
        React.createElement(SplitPaneWrapper, { splitOrientation: "vertical", paneSize: widthCalc, minSize: MIN_PANE_WIDTH, maxSize: MIN_PANE_WIDTH * -1, primary: "second", splitVisible: hasSplit, parentStyle: showCorrelationEditorBar ? { height: `calc(100% - ${theme.spacing(6)}` } : {}, paneStyle: { overflow: 'auto', display: 'flex', flexDirection: 'column' }, onDragFinished: (size) => size && updateSplitSize(size) }, panes.map(([exploreId]) => {
            return (React.createElement(ErrorBoundaryAlert, { key: exploreId, style: "page" },
                React.createElement(ExplorePaneContainer, { exploreId: exploreId })));
        }))));
}
const getStyles = (theme) => {
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
//# sourceMappingURL=ExplorePage.js.map