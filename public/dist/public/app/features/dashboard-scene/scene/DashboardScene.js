import { CoreApp } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { getUrlSyncManager, SceneFlexLayout, SceneGridItem, SceneGridLayout, SceneObjectBase, SceneObjectStateChangedEvent, sceneUtils, } from '@grafana/scenes';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardSceneRenderer } from '../scene/DashboardSceneRenderer';
import { SaveDashboardDrawer } from '../serialization/SaveDashboardDrawer';
import { DashboardModelCompatibilityWrapper } from '../utils/DashboardModelCompatibilityWrapper';
import { findVizPanelByKey, forceRenderChildren, getClosestVizPanel, getDashboardUrl, getPanelIdForVizPanel, } from '../utils/utils';
import { DashboardSceneUrlSync } from './DashboardSceneUrlSync';
export class DashboardScene extends SceneObjectBase {
    constructor(state) {
        var _a;
        super(Object.assign({ title: 'Dashboard', meta: {}, body: (_a = state.body) !== null && _a !== void 0 ? _a : new SceneFlexLayout({ children: [] }) }, state));
        /**
         * Handles url sync
         */
        this._urlSync = new DashboardSceneUrlSync(this);
        this.onEnterEditMode = () => {
            // Save this state
            this._initialState = sceneUtils.cloneSceneObjectState(this.state);
            this._initiallUrlState = locationService.getSearchObject();
            // Switch to edit mode
            this.setState({ isEditing: true });
            // Propagate change edit mode change to children
            if (this.state.body instanceof SceneGridLayout) {
                this.state.body.setState({ isDraggable: true, isResizable: true });
                forceRenderChildren(this.state.body, true);
            }
            this.startTrackingChanges();
        };
        this.onDiscard = () => {
            // No need to listen to changes anymore
            this.stopTrackingChanges();
            // Stop url sync before updating url
            this.stopUrlSync();
            // Now we can update url
            locationService.partial(this._initiallUrlState, true);
            // Update state and disable editing
            this.setState(Object.assign(Object.assign({}, this._initialState), { isEditing: false }));
            // and start url sync again
            this.startUrlSync();
            // Disable grid dragging
            if (this.state.body instanceof SceneGridLayout) {
                this.state.body.setState({ isDraggable: false, isResizable: false });
                forceRenderChildren(this.state.body, true);
            }
        };
        this.onSave = () => {
            this.setState({ overlay: new SaveDashboardDrawer({ dashboardRef: this.getRef() }) });
        };
        this.addActivationHandler(() => this._activationHandler());
    }
    _activationHandler() {
        window.__grafanaSceneContext = this;
        if (this.state.isEditing) {
            this.startTrackingChanges();
        }
        const oldDashboardWrapper = new DashboardModelCompatibilityWrapper(this);
        // @ts-expect-error
        getDashboardSrv().setCurrent(oldDashboardWrapper);
        // Deactivation logic
        return () => {
            window.__grafanaSceneContext = undefined;
            this.stopTrackingChanges();
            this.stopUrlSync();
            oldDashboardWrapper.destroy();
        };
    }
    startUrlSync() {
        getUrlSyncManager().initSync(this);
    }
    stopUrlSync() {
        getUrlSyncManager().cleanUp(this);
    }
    getPageNav(location) {
        let pageNav = {
            text: this.state.title,
            url: getDashboardUrl({
                uid: this.state.uid,
                currentQueryParams: location.search,
                updateQuery: { viewPanel: null, inspect: null },
            }),
        };
        if (this.state.viewPanelKey) {
            pageNav = {
                text: 'View panel',
                parentItem: pageNav,
            };
        }
        return pageNav;
    }
    /**
     * Returns the body (layout) or the full view panel
     */
    getBodyToRender(viewPanelKey) {
        const viewPanel = findVizPanelByKey(this, viewPanelKey);
        return viewPanel !== null && viewPanel !== void 0 ? viewPanel : this.state.body;
    }
    startTrackingChanges() {
        this._changeTrackerSub = this.subscribeToEvent(SceneObjectStateChangedEvent, (event) => {
            if (event.payload.changedObject instanceof SceneGridItem) {
                this.setIsDirty();
            }
        });
    }
    setIsDirty() {
        if (!this.state.isDirty) {
            this.setState({ isDirty: true });
        }
    }
    stopTrackingChanges() {
        var _a;
        (_a = this._changeTrackerSub) === null || _a === void 0 ? void 0 : _a.unsubscribe();
    }
    getInitialState() {
        return this._initialState;
    }
    showModal(modal) {
        this.setState({ overlay: modal });
    }
    closeModal() {
        this.setState({ overlay: undefined });
    }
    /**
     * Called by the SceneQueryRunner to privide contextural parameters (tracking) props for the request
     */
    enrichDataRequest(sceneObject) {
        var _a;
        const panel = getClosestVizPanel(sceneObject);
        return {
            app: CoreApp.Dashboard,
            dashboardUID: this.state.uid,
            panelId: (_a = (panel && getPanelIdForVizPanel(panel))) !== null && _a !== void 0 ? _a : 0,
        };
    }
    canEditDashboard() {
        return Boolean(this.state.meta.canEdit || this.state.meta.canMakeEditable);
    }
}
DashboardScene.Component = DashboardSceneRenderer;
//# sourceMappingURL=DashboardScene.js.map