// Libraries
import React, { useEffect } from 'react';
import { PageLayoutType } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { getDashboardScenePageStateManager } from './DashboardScenePageStateManager';
export function PanelEditPage({ match }) {
    const stateManager = getDashboardScenePageStateManager();
    const { panelEditor, isLoading, loadError } = stateManager.useState();
    useEffect(() => {
        stateManager.loadPanelEdit(match.params.uid, match.params.panelId);
        return () => {
            stateManager.clearState();
        };
    }, [stateManager, match.params.uid, match.params.panelId]);
    if (!panelEditor) {
        return (React.createElement(Page, { layout: PageLayoutType.Canvas },
            isLoading && React.createElement(PageLoader, null),
            loadError && React.createElement("h2", null, loadError)));
    }
    return React.createElement(panelEditor.Component, { model: panelEditor });
}
export default PanelEditPage;
//# sourceMappingURL=PanelEditPage.js.map