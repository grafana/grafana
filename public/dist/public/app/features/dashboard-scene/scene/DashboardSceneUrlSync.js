import { AppEvents } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { PanelInspectDrawer } from '../inspect/PanelInspectDrawer';
import { findVizPanelByKey } from '../utils/utils';
import { DashboardRepeatsProcessedEvent } from './types';
export class DashboardSceneUrlSync {
    constructor(_scene) {
        this._scene = _scene;
    }
    getKeys() {
        return ['inspect', 'viewPanel'];
    }
    getUrlState() {
        const state = this._scene.state;
        return { inspect: state.inspectPanelKey, viewPanel: state.viewPanelKey };
    }
    updateFromUrl(values) {
        const { inspectPanelKey: inspectPanelId, viewPanelKey: viewPanelId } = this._scene.state;
        const update = {};
        // Handle inspect object state
        if (typeof values.inspect === 'string') {
            const panel = findVizPanelByKey(this._scene, values.inspect);
            if (!panel) {
                appEvents.emit(AppEvents.alertError, ['Panel not found']);
                locationService.partial({ inspect: null });
                return;
            }
            update.inspectPanelKey = values.inspect;
            update.overlay = new PanelInspectDrawer({ panelRef: panel.getRef() });
        }
        else if (inspectPanelId) {
            update.inspectPanelKey = undefined;
            update.overlay = undefined;
        }
        // Handle view panel state
        if (typeof values.viewPanel === 'string') {
            const panel = findVizPanelByKey(this._scene, values.viewPanel);
            if (!panel) {
                // // If we are trying to view a repeat clone that can't be found it might be that the repeats have not been processed yet
                if (values.viewPanel.indexOf('clone')) {
                    this._handleViewRepeatClone(values.viewPanel);
                    return;
                }
                appEvents.emit(AppEvents.alertError, ['Panel not found']);
                locationService.partial({ viewPanel: null });
                return;
            }
            update.viewPanelKey = values.viewPanel;
        }
        else if (viewPanelId) {
            update.viewPanelKey = undefined;
        }
        if (Object.keys(update).length > 0) {
            this._scene.setState(update);
        }
    }
    _handleViewRepeatClone(viewPanel) {
        if (!this._eventSub) {
            this._eventSub = this._scene.subscribeToEvent(DashboardRepeatsProcessedEvent, () => {
                var _a;
                const panel = findVizPanelByKey(this._scene, viewPanel);
                if (panel) {
                    (_a = this._eventSub) === null || _a === void 0 ? void 0 : _a.unsubscribe();
                    this._scene.setState({ viewPanelKey: viewPanel });
                }
            });
        }
    }
}
//# sourceMappingURL=DashboardSceneUrlSync.js.map