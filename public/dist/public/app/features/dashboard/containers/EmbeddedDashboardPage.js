import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';
import { PageLayoutType } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Button, ModalsController, PageToolbar, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useDispatch, useSelector } from 'app/types';
import { updateTimeZoneForSession } from '../../profile/state/reducers';
import { DashNavTimeControls } from '../components/DashNav/DashNavTimeControls';
import { DashboardFailed } from '../components/DashboardLoading/DashboardFailed';
import { DashboardLoading } from '../components/DashboardLoading/DashboardLoading';
import { SaveDashboardDrawer } from '../components/EmbeddedDashboard/SaveDashboardDrawer';
import { DashboardGrid } from '../dashgrid/DashboardGrid';
import { DashboardModel } from '../state';
import { initDashboard } from '../state/initDashboard';
export default function EmbeddedDashboardPage({ route, queryParams }) {
    const dispatch = useDispatch();
    const context = useGrafana();
    const dashboardState = useSelector((store) => store.dashboard);
    const dashboard = dashboardState.getModel();
    const [dashboardJson, setDashboardJson] = useState('');
    /**
     * Create dashboard model and initialize the dashboard from JSON
     */
    useEffect(() => {
        const serverPort = queryParams.serverPort;
        if (!serverPort) {
            throw new Error('No serverPort provided');
        }
        getBackendSrv()
            .get(`http://localhost:${serverPort}/load-dashboard`)
            .then((dashboardJson) => {
            setDashboardJson(dashboardJson);
            // Remove dashboard UID from JSON to prevent errors from external dashboards
            delete dashboardJson.uid;
            const dashboardModel = new DashboardModel(dashboardJson);
            dispatch(initDashboard({
                routeName: route.routeName,
                fixUrl: false,
                keybindingSrv: context.keybindings,
                dashboardDto: { dashboard: dashboardModel, meta: { canEdit: true } },
            }));
        })
            .catch((err) => {
            console.log('Error getting dashboard JSON: ', err);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (!dashboard) {
        return React.createElement(DashboardLoading, { initPhase: dashboardState.initPhase });
    }
    if (dashboard.meta.dashboardNotFound) {
        return React.createElement("p", null, "Not available");
    }
    return (React.createElement(Page, { pageNav: { text: dashboard.title }, layout: PageLayoutType.Custom },
        React.createElement(Toolbar, { dashboard: dashboard, dashboardJson: dashboardJson }),
        dashboardState.initError && React.createElement(DashboardFailed, { initError: dashboardState.initError }),
        React.createElement("div", null,
            React.createElement(DashboardGrid, { dashboard: dashboard, isEditable: true, viewPanel: null, editPanel: null, hidePanelMenus: true }))));
}
const Toolbar = ({ dashboard, dashboardJson }) => {
    const dispatch = useDispatch();
    const styles = useStyles2(getStyles);
    const onChangeTimeZone = (timeZone) => {
        dispatch(updateTimeZoneForSession(timeZone));
    };
    const saveDashboard = (clone) => __awaiter(void 0, void 0, void 0, function* () {
        const params = locationService.getSearch();
        const serverPort = params.get('serverPort');
        if (!clone || !serverPort) {
            return;
        }
        return getBackendSrv().post(`http://localhost:${serverPort}/save-dashboard`, { dashboard: clone });
    });
    return (React.createElement(PageToolbar, { title: dashboard.title, buttonOverflowAlignment: "right", className: styles.toolbar },
        !dashboard.timepicker.hidden && (React.createElement(DashNavTimeControls, { dashboard: dashboard, onChangeTimeZone: onChangeTimeZone })),
        React.createElement(ModalsController, { key: "button-save" }, ({ showModal, hideModal }) => (React.createElement(Button, { onClick: () => {
                showModal(SaveDashboardDrawer, {
                    dashboard,
                    dashboardJson,
                    onDismiss: hideModal,
                    onSave: saveDashboard,
                });
            } }, "Save")))));
};
const getStyles = (theme) => {
    return {
        toolbar: css `
      padding: ${theme.spacing(3, 2)};
    `,
    };
};
//# sourceMappingURL=EmbeddedDashboardPage.js.map