import { isEmptyObject } from '@grafana/data';
import { SceneDataLayers, SceneGridItem, SceneGridLayout, SceneGridRow, VizPanel, SceneQueryRunner, SceneDataTransformer, SceneVariableSet, AdHocFilterSet, } from '@grafana/scenes';
import { defaultDashboard, VariableRefresh, } from '@grafana/schema';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { getPanelDataFrames } from 'app/features/dashboard/components/HelpWizard/utils';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { ShareQueryDataProvider } from '../scene/ShareQueryDataProvider';
import { getPanelIdForVizPanel } from '../utils/utils';
import { GRAFANA_DATASOURCE_REF } from './const';
import { dataLayersToAnnotations } from './dataLayersToAnnotations';
import { sceneVariablesSetToVariables } from './sceneVariablesSetToVariables';
export function transformSceneToSaveModel(scene, isSnapshot = false) {
    const state = scene.state;
    const timeRange = state.$timeRange.state;
    const data = state.$data;
    const variablesSet = state.$variables;
    const body = state.body;
    const panels = [];
    let variables = [];
    if (body instanceof SceneGridLayout) {
        for (const child of body.state.children) {
            if (child instanceof SceneGridItem) {
                panels.push(gridItemToPanel(child, isSnapshot));
            }
            if (child instanceof SceneGridRow) {
                // Skip repeat clones
                if (child.state.key.indexOf('-clone-') > 0) {
                    continue;
                }
                gridRowToSaveModel(child, panels, isSnapshot);
            }
        }
    }
    let annotations = [];
    if (data instanceof SceneDataLayers) {
        const layers = data.state.layers;
        annotations = dataLayersToAnnotations(layers);
    }
    if (variablesSet instanceof SceneVariableSet) {
        variables = sceneVariablesSetToVariables(variablesSet);
    }
    if (state.controls) {
        for (const control of state.controls) {
            if (control instanceof AdHocFilterSet) {
                variables.push({
                    name: control.state.name,
                    type: 'adhoc',
                    datasource: control.state.datasource,
                });
            }
        }
    }
    const dashboard = Object.assign(Object.assign({}, defaultDashboard), { title: state.title, uid: state.uid, id: state.id, time: {
            from: timeRange.from,
            to: timeRange.to,
        }, panels, annotations: {
            list: annotations,
        }, templating: {
            list: variables,
        }, timezone: timeRange.timeZone, fiscalYearStartMonth: timeRange.fiscalYearStartMonth, weekStart: timeRange.weekStart });
    return sortedDeepCloneWithoutNulls(dashboard);
}
export function gridItemToPanel(gridItem, isSnapshot = false) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    let vizPanel;
    let x = 0, y = 0, w = 0, h = 0;
    if (gridItem instanceof SceneGridItem) {
        // Handle library panels, early exit
        if (gridItem.state.body instanceof LibraryVizPanel) {
            x = (_a = gridItem.state.x) !== null && _a !== void 0 ? _a : 0;
            y = (_b = gridItem.state.y) !== null && _b !== void 0 ? _b : 0;
            w = (_c = gridItem.state.width) !== null && _c !== void 0 ? _c : 0;
            h = (_d = gridItem.state.height) !== null && _d !== void 0 ? _d : 0;
            return {
                id: getPanelIdForVizPanel(gridItem.state.body),
                title: gridItem.state.body.state.title,
                gridPos: { x, y, w, h },
                libraryPanel: {
                    name: gridItem.state.body.state.name,
                    uid: gridItem.state.body.state.uid,
                },
            };
        }
        if (!(gridItem.state.body instanceof VizPanel)) {
            throw new Error('SceneGridItem body expected to be VizPanel');
        }
        vizPanel = gridItem.state.body;
        x = (_e = gridItem.state.x) !== null && _e !== void 0 ? _e : 0;
        y = (_f = gridItem.state.y) !== null && _f !== void 0 ? _f : 0;
        w = (_g = gridItem.state.width) !== null && _g !== void 0 ? _g : 0;
        h = (_h = gridItem.state.height) !== null && _h !== void 0 ? _h : 0;
    }
    if (gridItem instanceof PanelRepeaterGridItem) {
        vizPanel = gridItem.state.source;
        x = (_j = gridItem.state.x) !== null && _j !== void 0 ? _j : 0;
        y = (_k = gridItem.state.y) !== null && _k !== void 0 ? _k : 0;
        w = (_l = gridItem.state.width) !== null && _l !== void 0 ? _l : 0;
        h = (_m = gridItem.state.height) !== null && _m !== void 0 ? _m : 0;
    }
    if (!vizPanel) {
        throw new Error('Unsupported grid item type');
    }
    const panel = {
        id: getPanelIdForVizPanel(vizPanel),
        type: vizPanel.state.pluginId,
        title: vizPanel.state.title,
        gridPos: { x, y, w, h },
        options: vizPanel.state.options,
        fieldConfig: (_o = vizPanel.state.fieldConfig) !== null && _o !== void 0 ? _o : { defaults: {}, overrides: [] },
        transformations: [],
        transparent: vizPanel.state.displayMode === 'transparent',
    };
    const panelTime = vizPanel.state.$timeRange;
    if (panelTime instanceof PanelTimeRange) {
        panel.timeFrom = panelTime.state.timeFrom;
        panel.timeShift = panelTime.state.timeShift;
        panel.hideTimeOverride = panelTime.state.hideTimeOverride;
    }
    const dataProvider = vizPanel.state.$data;
    // Dashboard datasource handling
    if (dataProvider instanceof ShareQueryDataProvider) {
        panel.datasource = {
            type: 'datasource',
            uid: SHARED_DASHBOARD_QUERY,
        };
        panel.targets = [
            {
                datasource: Object.assign({}, panel.datasource),
                refId: 'A',
                panelId: dataProvider.state.query.panelId,
                topic: dataProvider.state.query.topic,
            },
        ];
    }
    // Regular queries handling
    if (dataProvider instanceof SceneQueryRunner) {
        panel.targets = dataProvider.state.queries;
        panel.maxDataPoints = dataProvider.state.maxDataPoints;
        panel.datasource = dataProvider.state.datasource;
    }
    // Transformations handling
    if (dataProvider instanceof SceneDataTransformer) {
        const panelData = dataProvider.state.$data;
        if (panelData instanceof ShareQueryDataProvider) {
            panel.datasource = {
                type: 'datasource',
                uid: SHARED_DASHBOARD_QUERY,
            };
            panel.targets = [
                {
                    datasource: Object.assign({}, panel.datasource),
                    refId: 'A',
                    panelId: panelData.state.query.panelId,
                    topic: panelData.state.query.topic,
                },
            ];
        }
        if (panelData instanceof SceneQueryRunner) {
            panel.targets = panelData.state.queries;
            panel.maxDataPoints = panelData.state.maxDataPoints;
            panel.datasource = panelData.state.datasource;
        }
        panel.transformations = dataProvider.state.transformations;
    }
    if (dataProvider && isSnapshot) {
        panel.datasource = GRAFANA_DATASOURCE_REF;
        let data = getPanelDataFrames(dataProvider.state.data);
        if (dataProvider instanceof SceneDataTransformer) {
            // For transformations the non-transformed data is snapshoted
            data = getPanelDataFrames(dataProvider.state.$data.state.data);
        }
        panel.targets = [
            {
                refId: 'A',
                datasource: panel.datasource,
                queryType: GrafanaQueryType.Snapshot,
                snapshot: data,
            },
        ];
    }
    if (gridItem instanceof PanelRepeaterGridItem) {
        panel.repeat = gridItem.state.variableName;
        panel.maxPerRow = gridItem.state.maxPerRow;
        panel.repeatDirection = gridItem.getRepeatDirection();
    }
    return panel;
}
export function gridRowToSaveModel(gridRow, panelsArray, isSnapshot = false) {
    var _a, _b, _c, _d, _e;
    const rowPanel = {
        type: 'row',
        id: getPanelIdForVizPanel(gridRow),
        title: gridRow.state.title,
        gridPos: {
            x: (_a = gridRow.state.x) !== null && _a !== void 0 ? _a : 0,
            y: (_b = gridRow.state.y) !== null && _b !== void 0 ? _b : 0,
            w: (_c = gridRow.state.width) !== null && _c !== void 0 ? _c : 24,
            h: (_d = gridRow.state.height) !== null && _d !== void 0 ? _d : 1,
        },
        collapsed: Boolean(gridRow.state.isCollapsed),
        panels: [],
    };
    if ((_e = gridRow.state.$behaviors) === null || _e === void 0 ? void 0 : _e.length) {
        const behavior = gridRow.state.$behaviors[0];
        if (behavior instanceof RowRepeaterBehavior) {
            rowPanel.repeat = behavior.state.variableName;
        }
    }
    panelsArray.push(rowPanel);
    const panelsInsideRow = gridRow.state.children.map((c) => gridItemToPanel(c, isSnapshot));
    if (gridRow.state.isCollapsed) {
        rowPanel.panels = panelsInsideRow;
    }
    else {
        panelsArray.push(...panelsInsideRow);
    }
}
export function trimDashboardForSnapshot(title, time, dash, panel) {
    var _a, _b, _c, _d;
    let result = Object.assign(Object.assign({}, dash), { title, time: {
            from: time.from.toISOString(),
            to: time.to.toISOString(),
        }, links: [] });
    // When VizPanel is present, we are snapshoting a single panel. The rest of the panels is removed from the dashboard,
    // and the panel is resized to 24x20 grid and placed at the top of the dashboard.
    if (panel) {
        // @ts-expect-error Due to legacy panels types. Id is present on such panels too.
        const singlePanel = (_a = dash.panels) === null || _a === void 0 ? void 0 : _a.find((p) => p.id === getPanelIdForVizPanel(panel));
        if (singlePanel) {
            // @ts-expect-error Due to legacy panels types. Id is present on such panels too.
            singlePanel.gridPos = { w: 24, x: 0, y: 0, h: 20 };
            result = Object.assign(Object.assign({}, result), { panels: [singlePanel] });
        }
    }
    // Remove links from all panels
    (_b = result.panels) === null || _b === void 0 ? void 0 : _b.forEach((panel) => {
        if ('links' in panel) {
            panel.links = [];
        }
    });
    // Remove annotation queries, attach snapshotData: [] for backwards compatibility
    if (result.annotations) {
        const annotations = ((_c = result.annotations.list) === null || _c === void 0 ? void 0 : _c.filter((annotation) => annotation.enable)) || [];
        const trimedAnnotations = annotations.map((annotation) => {
            return {
                name: annotation.name,
                enable: annotation.enable,
                iconColor: annotation.iconColor,
                type: annotation.type,
                builtIn: annotation.builtIn,
                hide: annotation.hide,
                // TODO: Remove when we migrate snapshots to snapshot queries.
                // For now leaving this in here to avoid annotation queries in snapshots.
                // Annotations per panel are part of the snapshot query, so we don't need to store them here.
                snapshotData: [],
            };
        });
        result.annotations.list = trimedAnnotations;
    }
    if (result.templating) {
        (_d = result.templating.list) === null || _d === void 0 ? void 0 : _d.forEach((variable) => {
            if ('query' in variable) {
                variable.query = '';
            }
            if ('options' in variable) {
                variable.options = variable.current && !isEmptyObject(variable.current) ? [variable.current] : [];
            }
            if ('refresh' in variable) {
                variable.refresh = VariableRefresh.never;
            }
        });
    }
    return result;
}
//# sourceMappingURL=transformSceneToSaveModel.js.map