import { locationService } from '@grafana/runtime';
import { getUrlSyncManager, SceneFlexItem, SceneFlexLayout, SceneObjectBase, sceneUtils, SplitLayout, } from '@grafana/scenes';
import { getDashboardUrl } from '../utils/utils';
import { PanelEditorRenderer } from './PanelEditorRenderer';
import { PanelOptionsPane } from './PanelOptionsPane';
export class PanelEditor extends SceneObjectBase {
    constructor(state) {
        super(state);
        this.onDiscard = () => {
            // Open question on what to preserve when going back
            // Preserve time range, and variables state (that might have been changed while in panel edit)
            // Preserve current panel data? (say if you just changed the time range and have new data)
            this._navigateBackToDashboard();
        };
        this.onApply = () => {
            this._commitChanges();
            this._navigateBackToDashboard();
        };
        this.onSave = () => {
            this._commitChanges();
            // Open dashboard save drawer
        };
        this.addActivationHandler(() => this._activationHandler());
    }
    _activationHandler() {
        // Deactivation logic
        return () => {
            getUrlSyncManager().cleanUp(this);
        };
    }
    startUrlSync() {
        getUrlSyncManager().initSync(this);
    }
    getPageNav(location) {
        return {
            text: 'Edit panel',
            parentItem: this.state.dashboardRef.resolve().getPageNav(location),
        };
    }
    _commitChanges() {
        var _a, _b;
        const dashboard = this.state.dashboardRef.resolve();
        const sourcePanel = this.state.sourcePanelRef.resolve();
        const panel = this.state.panelRef.resolve();
        if (!dashboard.state.isEditing) {
            dashboard.onEnterEditMode();
        }
        const newState = sceneUtils.cloneSceneObjectState(panel.state);
        sourcePanel.setState(newState);
        // preserve time range and variables state
        dashboard.setState({
            $timeRange: (_a = this.state.$timeRange) === null || _a === void 0 ? void 0 : _a.clone(),
            $variables: (_b = this.state.$variables) === null || _b === void 0 ? void 0 : _b.clone(),
            isDirty: true,
        });
    }
    _navigateBackToDashboard() {
        locationService.push(getDashboardUrl({
            uid: this.state.dashboardRef.resolve().state.uid,
            currentQueryParams: locationService.getLocation().search,
        }));
    }
}
PanelEditor.Component = PanelEditorRenderer;
export function buildPanelEditScene(dashboard, panel) {
    const panelClone = panel.clone();
    const dashboardStateCloned = sceneUtils.cloneSceneObjectState(dashboard.state);
    return new PanelEditor({
        dashboardRef: dashboard.getRef(),
        sourcePanelRef: panel.getRef(),
        panelRef: panelClone.getRef(),
        controls: dashboardStateCloned.controls,
        $variables: dashboardStateCloned.$variables,
        $timeRange: dashboardStateCloned.$timeRange,
        body: new SplitLayout({
            direction: 'row',
            primary: new SceneFlexLayout({
                direction: 'column',
                children: [panelClone],
            }),
            secondary: new SceneFlexItem({
                width: '300px',
                body: new PanelOptionsPane(panelClone),
            }),
        }),
    });
}
//# sourceMappingURL=PanelEditor.js.map