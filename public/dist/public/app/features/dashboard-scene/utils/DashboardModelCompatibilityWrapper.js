import { Subscription } from 'rxjs';
import { DashboardCursorSync, dateTimeFormat, EventBusSrv } from '@grafana/data';
import { TimeRangeUpdatedEvent } from '@grafana/runtime';
import { behaviors, SceneDataTransformer, sceneGraph } from '@grafana/scenes';
import { findVizPanelByKey, getVizPanelKeyForPanelId } from './utils';
/**
 * Will move this to make it the main way we remain somewhat compatible with getDashboardSrv().getCurrent
 */
export class DashboardModelCompatibilityWrapper {
    constructor(_scene) {
        this._scene = _scene;
        this.events = new EventBusSrv();
        this._subs = new Subscription();
        const timeRange = sceneGraph.getTimeRange(_scene);
        this._subs.add(timeRange.subscribeToState((state, prev) => {
            if (state.value !== prev.value) {
                this.events.publish(new TimeRangeUpdatedEvent(state.value));
            }
        }));
    }
    get id() {
        var _a;
        return (_a = this._scene.state.id) !== null && _a !== void 0 ? _a : null;
    }
    get uid() {
        var _a;
        return (_a = this._scene.state.uid) !== null && _a !== void 0 ? _a : null;
    }
    get title() {
        return this._scene.state.title;
    }
    get meta() {
        return this._scene.state.meta;
    }
    get time() {
        const time = sceneGraph.getTimeRange(this._scene);
        return {
            from: time.state.from,
            to: time.state.to,
        };
    }
    /**
     * Used from from timeseries migration handler to migrate time regions to dashboard annotations
     */
    get annotations() {
        console.error('Scenes DashboardModelCompatibilityWrapper.annotations not implemented (yet)');
        return { list: [] };
    }
    getTimezone() {
        const time = sceneGraph.getTimeRange(this._scene);
        return time.getTimeZone();
    }
    sharedTooltipModeEnabled() {
        return this._getSyncMode() > 0;
    }
    sharedCrosshairModeOnly() {
        return this._getSyncMode() === 1;
    }
    _getSyncMode() {
        if (this._scene.state.$behaviors) {
            for (const behavior of this._scene.state.$behaviors) {
                if (behavior instanceof behaviors.CursorSync) {
                    return behavior.state.sync;
                }
            }
        }
        return DashboardCursorSync.Off;
    }
    otherPanelInFullscreen(panel) {
        return false;
    }
    formatDate(date, format) {
        return dateTimeFormat(date, {
            format,
            timeZone: this.getTimezone(),
        });
    }
    getPanelById(id) {
        const vizPanel = findVizPanelByKey(this._scene, getVizPanelKeyForPanelId(id));
        if (vizPanel) {
            return new PanelCompatibilityWrapper(vizPanel);
        }
        return null;
    }
    removePanel(panel) {
        // TODO
        console.error('Scenes DashboardModelCompatibilityWrapper.removePanel not implemented (yet)');
    }
    canEditAnnotations(dashboardUID) {
        // TOOD
        return false;
    }
    panelInitialized() { }
    destroy() {
        this.events.removeAllListeners();
        this._subs.unsubscribe();
    }
}
class PanelCompatibilityWrapper {
    constructor(_vizPanel) {
        this._vizPanel = _vizPanel;
    }
    get type() {
        return this._vizPanel.state.pluginId;
    }
    get title() {
        return this._vizPanel.state.title;
    }
    get transformations() {
        if (this._vizPanel.state.$data instanceof SceneDataTransformer) {
            return this._vizPanel.state.$data.state.transformations;
        }
        return [];
    }
    refresh() {
        console.error('Scenes PanelCompatibilityWrapper.refresh no implemented (yet)');
    }
    render() {
        console.error('Scenes PanelCompatibilityWrapper.render no implemented (yet)');
    }
    getQueryRunner() {
        console.error('Scenes PanelCompatibilityWrapper.getQueryRunner no implemented (yet)');
    }
}
//# sourceMappingURL=DashboardModelCompatibilityWrapper.js.map