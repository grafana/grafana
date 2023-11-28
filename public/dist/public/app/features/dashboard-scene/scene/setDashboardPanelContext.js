import { __awaiter } from "tslib";
import { AnnotationChangeEvent, CoreApp } from '@grafana/data';
import { AdHocFilterSet, dataLayers, SceneDataLayers } from '@grafana/scenes';
import { deleteAnnotation, saveAnnotation, updateAnnotation } from 'app/features/annotations/api';
import { getDashboardSceneFor, getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';
export function setDashboardPanelContext(vizPanel, context) {
    context.app = CoreApp.Dashboard;
    context.canAddAnnotations = () => {
        var _a;
        const dashboard = getDashboardSceneFor(vizPanel);
        const builtInLayer = getBuiltInAnnotationsLayer(dashboard);
        // When there is no builtin annotations query we disable the ability to add annotations
        if (!builtInLayer || !dashboard.canEditDashboard()) {
            return false;
        }
        // If RBAC is enabled there are additional conditions to check.
        return Boolean((_a = dashboard.state.meta.annotationsPermissions) === null || _a === void 0 ? void 0 : _a.dashboard.canAdd);
    };
    context.canEditAnnotations = (dashboardUID) => {
        var _a, _b;
        const dashboard = getDashboardSceneFor(vizPanel);
        if (!dashboard.canEditDashboard()) {
            return false;
        }
        if (dashboardUID) {
            return Boolean((_a = dashboard.state.meta.annotationsPermissions) === null || _a === void 0 ? void 0 : _a.dashboard.canEdit);
        }
        return Boolean((_b = dashboard.state.meta.annotationsPermissions) === null || _b === void 0 ? void 0 : _b.organization.canEdit);
    };
    context.canDeleteAnnotations = (dashboardUID) => {
        var _a, _b;
        const dashboard = getDashboardSceneFor(vizPanel);
        if (!dashboard.canEditDashboard()) {
            return false;
        }
        if (dashboardUID) {
            return Boolean((_a = dashboard.state.meta.annotationsPermissions) === null || _a === void 0 ? void 0 : _a.dashboard.canDelete);
        }
        return Boolean((_b = dashboard.state.meta.annotationsPermissions) === null || _b === void 0 ? void 0 : _b.organization.canDelete);
    };
    context.onAnnotationCreate = (event) => __awaiter(this, void 0, void 0, function* () {
        const dashboard = getDashboardSceneFor(vizPanel);
        const isRegion = event.from !== event.to;
        const anno = {
            dashboardUID: dashboard.state.uid,
            panelId: getPanelIdForVizPanel(vizPanel),
            isRegion,
            time: event.from,
            timeEnd: isRegion ? event.to : 0,
            tags: event.tags,
            text: event.description,
        };
        yield saveAnnotation(anno);
        reRunBuiltInAnnotationsLayer(dashboard);
        context.eventBus.publish(new AnnotationChangeEvent(anno));
    });
    context.onAnnotationUpdate = (event) => __awaiter(this, void 0, void 0, function* () {
        const dashboard = getDashboardSceneFor(vizPanel);
        const isRegion = event.from !== event.to;
        const anno = {
            id: event.id,
            dashboardUID: dashboard.state.uid,
            panelId: getPanelIdForVizPanel(vizPanel),
            isRegion,
            time: event.from,
            timeEnd: isRegion ? event.to : 0,
            tags: event.tags,
            text: event.description,
        };
        yield updateAnnotation(anno);
        reRunBuiltInAnnotationsLayer(dashboard);
        context.eventBus.publish(new AnnotationChangeEvent(anno));
    });
    context.onAnnotationDelete = (id) => __awaiter(this, void 0, void 0, function* () {
        yield deleteAnnotation({ id });
        reRunBuiltInAnnotationsLayer(getDashboardSceneFor(vizPanel));
        context.eventBus.publish(new AnnotationChangeEvent({ id }));
    });
    context.onAddAdHocFilter = (newFilter) => {
        const dashboard = getDashboardSceneFor(vizPanel);
        const queryRunner = getQueryRunnerFor(vizPanel);
        if (!queryRunner) {
            return;
        }
        const filterSet = getAdHocFilterSetFor(dashboard, queryRunner.state.datasource);
        updateAdHocFilterSet(filterSet, newFilter);
    };
    context.onUpdateData = (frames) => {
        // TODO
        //return onUpdatePanelSnapshotData(this.props.panel, frames);
        return Promise.resolve(true);
    };
}
function getBuiltInAnnotationsLayer(scene) {
    // When there is no builtin annotations query we disable the ability to add annotations
    if (scene.state.$data instanceof SceneDataLayers) {
        for (const layer of scene.state.$data.state.layers) {
            if (layer instanceof dataLayers.AnnotationsDataLayer) {
                if (layer.state.isEnabled && layer.state.query.builtIn) {
                    return layer;
                }
            }
        }
    }
    return undefined;
}
function reRunBuiltInAnnotationsLayer(scene) {
    const layer = getBuiltInAnnotationsLayer(scene);
    if (layer) {
        layer.runLayer();
    }
}
export function getAdHocFilterSetFor(scene, ds) {
    var _a, _b;
    const controls = (_a = scene.state.controls) !== null && _a !== void 0 ? _a : [];
    for (const control of controls) {
        if (control instanceof AdHocFilterSet) {
            if (control.state.datasource === ds || ((_b = control.state.datasource) === null || _b === void 0 ? void 0 : _b.uid) === (ds === null || ds === void 0 ? void 0 : ds.uid)) {
                return control;
            }
        }
    }
    const newSet = new AdHocFilterSet({ datasource: ds });
    // Add it to the scene
    scene.setState({
        controls: [controls[0], newSet, ...controls.slice(1)],
    });
    return newSet;
}
function updateAdHocFilterSet(filterSet, newFilter) {
    // Check if we need to update an existing filter
    for (const filter of filterSet.state.filters) {
        if (filter.key === newFilter.key) {
            filterSet.setState({
                filters: filterSet.state.filters.map((f) => {
                    if (f.key === newFilter.key) {
                        return newFilter;
                    }
                    return f;
                }),
            });
            return;
        }
    }
    // Add new filter
    filterSet.setState({
        filters: [...filterSet.state.filters, newFilter],
    });
}
//# sourceMappingURL=setDashboardPanelContext.js.map