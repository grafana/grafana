import { css } from '@emotion/css';
import React, { useEffect, useMemo, useRef } from 'react';
import { connect } from 'react-redux';
import { EventBusSrv } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { useStyles2, CustomScrollbar } from '@grafana/ui';
import { stopQueryState } from 'app/core/utils/explore';
import { useSelector } from 'app/types';
import Explore from './Explore';
import { getExploreItemSelector } from './state/selectors';
const getStyles = (theme) => {
    return {
        explore: css `
      label: explorePaneContainer;
      display: flex;
      flex-direction: column;
      min-width: 600px;
      height: 100%;
    `,
    };
};
/*
  Connected components subscribe to the store before function components (using hooks) and can react to store changes. Thus, this connector function is called before the parent component (ExplorePage) is rerendered.
  This means that child components' mapStateToProps will be executed with a zombie `exploreId` that is not present anymore in the store if the pane gets closed.
  By connecting this component and returning the pane we workaround the zombie children issue here instead of modifying every children.
  This is definitely not the ideal solution and we should in the future invest more time in exploring other approaches to better handle this scenario, potentially by refactoring panels to be function components
  (therefore immune to this behaviour), or by forbidding them to access the store directly and instead pass them all the data they need via props or context.

  You can read more about this issue here: https://react-redux.js.org/api/hooks#stale-props-and-zombie-children
*/
function ExplorePaneContainerUnconnected({ exploreId }) {
    useStopQueries(exploreId);
    const styles = useStyles2(getStyles);
    const eventBus = useRef(new EventBusSrv());
    const ref = useRef(null);
    useEffect(() => {
        const bus = eventBus.current;
        return () => bus.removeAllListeners();
    }, []);
    return (React.createElement(CustomScrollbar, null,
        React.createElement("div", { className: styles.explore, ref: ref, "data-testid": selectors.pages.Explore.General.container },
            React.createElement(Explore, { exploreId: exploreId, eventBus: eventBus.current }))));
}
function mapStateToProps(state, props) {
    const pane = state.explore.panes[props.exploreId];
    return { pane };
}
const connector = connect(mapStateToProps);
export const ExplorePaneContainer = connector(ExplorePaneContainerUnconnected);
function useStopQueries(exploreId) {
    const paneSelector = useMemo(() => getExploreItemSelector(exploreId), [exploreId]);
    const paneRef = useRef();
    paneRef.current = useSelector(paneSelector);
    useEffect(() => {
        return () => {
            var _a;
            stopQueryState((_a = paneRef.current) === null || _a === void 0 ? void 0 : _a.querySubscription);
        };
    }, []);
}
//# sourceMappingURL=ExplorePaneContainer.js.map