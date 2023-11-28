// Libraries
import React, { useEffect } from 'react';
import { PageLayoutType } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';
export function DashboardScenePage({ match }) {
    const stateManager = getDashboardScenePageStateManager();
    const { dashboard, isLoading, loadError } = stateManager.useState();
    useEffect(() => {
        stateManager.loadDashboard(match.params.uid);
        return () => {
            stateManager.clearState();
        };
    }, [stateManager, match.params.uid]);
    if (!dashboard) {
        return (React.createElement(Page, { layout: PageLayoutType.Canvas },
            isLoading && React.createElement(PageLoader, null),
            loadError && React.createElement("h2", null, loadError)));
    }
    return React.createElement(dashboard.Component, { model: dashboard });
}
export default DashboardScenePage;
//# sourceMappingURL=DashboardScenePage.js.map