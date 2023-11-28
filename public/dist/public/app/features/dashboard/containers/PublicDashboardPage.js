import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { usePrevious } from 'react-use';
import { PageLayoutType } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { PageToolbar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { updateTimeZoneForSession } from 'app/features/profile/state/reducers';
import { useSelector, useDispatch } from 'app/types';
import { DashNavTimeControls } from '../components/DashNav/DashNavTimeControls';
import { DashboardFailed } from '../components/DashboardLoading/DashboardFailed';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { PublicDashboardFooter } from '../components/PublicDashboard/PublicDashboardsFooter';
import { useGetPublicDashboardConfig } from '../components/PublicDashboard/usePublicDashboardConfig';
import { PublicDashboardNotAvailable } from '../components/PublicDashboardNotAvailable/PublicDashboardNotAvailable';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { getTimeSrv } from '../services/TimeSrv';
import { initDashboard } from '../state/initDashboard';
const selectors = e2eSelectors.pages.PublicDashboard;
const Toolbar = ({ dashboard }) => {
    const dispatch = useDispatch();
    const conf = useGetPublicDashboardConfig();
    const onChangeTimeZone = (timeZone) => {
        dispatch(updateTimeZoneForSession(timeZone));
    };
    return (React.createElement(PageToolbar, { title: dashboard.title, pageIcon: !conf.headerLogoHide ? 'grafana' : undefined, buttonOverflowAlignment: "right" }, !dashboard.timepicker.hidden && (React.createElement(DashNavTimeControls, { dashboard: dashboard, onChangeTimeZone: onChangeTimeZone }))));
};
const PublicDashboardPage = (props) => {
    const { match, route, location } = props;
    const dispatch = useDispatch();
    const context = useGrafana();
    const prevProps = usePrevious(props);
    const styles = useStyles2(getStyles);
    const dashboardState = useSelector((store) => store.dashboard);
    const dashboard = dashboardState.getModel();
    useEffect(() => {
        dispatch(initDashboard({
            routeName: route.routeName,
            fixUrl: false,
            accessToken: match.params.accessToken,
            keybindingSrv: context.keybindings,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if ((prevProps === null || prevProps === void 0 ? void 0 : prevProps.location.search) !== location.search) {
            const prevUrlParams = prevProps === null || prevProps === void 0 ? void 0 : prevProps.queryParams;
            const urlParams = props.queryParams;
            const updateTimeRangeFromUrl = ((urlParams === null || urlParams === void 0 ? void 0 : urlParams.from) !== (prevUrlParams === null || prevUrlParams === void 0 ? void 0 : prevUrlParams.from) || (urlParams === null || urlParams === void 0 ? void 0 : urlParams.to) !== (prevUrlParams === null || prevUrlParams === void 0 ? void 0 : prevUrlParams.to)) &&
                !(dashboard === null || dashboard === void 0 ? void 0 : dashboard.timepicker.hidden);
            if (updateTimeRangeFromUrl) {
                getTimeSrv().updateTimeRangeFromUrl();
            }
            if (!(prevUrlParams === null || prevUrlParams === void 0 ? void 0 : prevUrlParams.refresh) && (urlParams === null || urlParams === void 0 ? void 0 : urlParams.refresh)) {
                getTimeSrv().setAutoRefresh(urlParams.refresh);
            }
        }
    }, [prevProps, location.search, props.queryParams, dashboard === null || dashboard === void 0 ? void 0 : dashboard.timepicker.hidden]);
    if (!dashboard) {
        return React.createElement(DashboardLoading, { initPhase: dashboardState.initPhase });
    }
    if (dashboard.meta.publicDashboardEnabled === false) {
        return React.createElement(PublicDashboardNotAvailable, { paused: true });
    }
    if (dashboard.meta.dashboardNotFound) {
        return React.createElement(PublicDashboardNotAvailable, null);
    }
    return (React.createElement(Page, { pageNav: { text: dashboard.title }, layout: PageLayoutType.Custom, "data-testid": selectors.page },
        React.createElement(Toolbar, { dashboard: dashboard }),
        dashboardState.initError && React.createElement(DashboardFailed, { initError: dashboardState.initError }),
        React.createElement("div", { className: styles.gridContainer },
            React.createElement(DashboardGrid, { dashboard: dashboard, isEditable: false, viewPanel: null, editPanel: null, hidePanelMenus: true })),
        React.createElement(PublicDashboardFooter, null)));
};
const getStyles = (theme) => ({
    gridContainer: css({
        flex: 1,
        padding: theme.spacing(2, 2, 2, 2),
        overflow: 'auto',
    }),
});
export default PublicDashboardPage;
//# sourceMappingURL=PublicDashboardPage.js.map