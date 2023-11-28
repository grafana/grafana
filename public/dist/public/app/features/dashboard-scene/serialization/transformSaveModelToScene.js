import { VizPanel, SceneTimePicker, SceneGridLayout, SceneGridRow, SceneTimeRange, SceneVariableSet, VariableValueSelectors, CustomVariable, DataSourceVariable, QueryVariable, ConstantVariable, IntervalVariable, SceneRefreshPicker, SceneGridItem, SceneControlsSpacer, VizPanelMenu, behaviors, SceneDataLayers, SceneDataLayerControls, AdHocFilterSet, } from '@grafana/scenes';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { setDashboardPanelContext } from '../scene/setDashboardPanelContext';
import { createPanelDataProvider } from '../utils/createPanelDataProvider';
import { getCurrentValueForOldIntervalModel, getIntervalsFromOldIntervalModel, getVizPanelKeyForPanelId, } from '../utils/utils';
import { getAngularPanelMigrationHandler } from './angularMigration';
export function transformSaveModelToScene(rsp) {
    // Just to have migrations run
    const oldModel = new DashboardModel(rsp.dashboard, rsp.meta, {
        autoMigrateOldPanels: false,
    });
    return createDashboardSceneFromDashboardModel(oldModel);
}
export function createSceneObjectsForPanels(oldPanels) {
    var _a;
    // collects all panels and rows
    const panels = [];
    // indicates expanded row that's currently processed
    let currentRow = null;
    // collects panels in the currently processed, expanded row
    let currentRowPanels = [];
    for (const panel of oldPanels) {
        if (panel.type === 'row') {
            if (!currentRow) {
                if (Boolean(panel.collapsed)) {
                    // collapsed rows contain their panels within the row model
                    panels.push(createRowFromPanelModel(panel, []));
                }
                else {
                    // indicate new row to be processed
                    currentRow = panel;
                }
            }
            else {
                // when a row has been processed, and we hit a next one for processing
                if (currentRow.id !== panel.id) {
                    // commit previous row panels
                    panels.push(createRowFromPanelModel(currentRow, currentRowPanels));
                    currentRow = panel;
                    currentRowPanels = [];
                }
            }
        }
        else if (((_a = panel.libraryPanel) === null || _a === void 0 ? void 0 : _a.uid) && !('model' in panel.libraryPanel)) {
            const gridItem = buildGridItemForLibPanel(panel);
            if (gridItem) {
                panels.push(gridItem);
            }
        }
        else {
            const panelObject = buildGridItemForPanel(panel);
            // when processing an expanded row, collect its panels
            if (currentRow) {
                currentRowPanels.push(panelObject);
            }
            else {
                panels.push(panelObject);
            }
        }
    }
    // commit a row if it's the last one
    if (currentRow) {
        panels.push(createRowFromPanelModel(currentRow, currentRowPanels));
    }
    return panels;
}
function createRowFromPanelModel(row, content) {
    if (Boolean(row.collapsed)) {
        if (row.panels) {
            content = row.panels.map(buildGridItemForPanel);
        }
    }
    let behaviors;
    let children = content;
    if (row.repeat) {
        // For repeated rows the children are stored in the behavior
        children = [];
        behaviors = [
            new RowRepeaterBehavior({
                variableName: row.repeat,
                sources: content,
            }),
        ];
    }
    return new SceneGridRow({
        key: getVizPanelKeyForPanelId(row.id),
        title: row.title,
        y: row.gridPos.y,
        isCollapsed: row.collapsed,
        children: children,
        $behaviors: behaviors,
    });
}
export function createDashboardSceneFromDashboardModel(oldModel) {
    var _a, _b, _c, _d, _e;
    let variables = undefined;
    let layers = [];
    let filtersSets = [];
    if ((_b = (_a = oldModel.templating) === null || _a === void 0 ? void 0 : _a.list) === null || _b === void 0 ? void 0 : _b.length) {
        const variableObjects = oldModel.templating.list
            .map((v) => {
            var _a, _b;
            try {
                if (isAdhocVariable(v)) {
                    filtersSets.push(new AdHocFilterSet({
                        name: v.name,
                        datasource: v.datasource,
                        filters: (_a = v.filters) !== null && _a !== void 0 ? _a : [],
                        baseFilters: (_b = v.baseFilters) !== null && _b !== void 0 ? _b : [],
                    }));
                    return null;
                }
                return createSceneVariableFromVariableModel(v);
            }
            catch (err) {
                console.error(err);
                return null;
            }
        })
            // TODO: Remove filter
            // Added temporarily to allow skipping non-compatible variables
            .filter((v) => Boolean(v));
        variables = new SceneVariableSet({
            variables: variableObjects,
        });
    }
    if ((_d = (_c = oldModel.annotations) === null || _c === void 0 ? void 0 : _c.list) === null || _d === void 0 ? void 0 : _d.length) {
        layers = (_e = oldModel.annotations) === null || _e === void 0 ? void 0 : _e.list.map((a) => {
            // Each annotation query is an individual data layer
            return new DashboardAnnotationsDataLayer({
                query: a,
                name: a.name,
                isEnabled: Boolean(a.enable),
                isHidden: Boolean(a.hide),
            });
        });
    }
    const controls = [
        new VariableValueSelectors({}),
        ...filtersSets,
        new SceneDataLayerControls(),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({
            refresh: oldModel.refresh,
            intervals: oldModel.timepicker.refresh_intervals,
        }),
    ];
    return new DashboardScene({
        title: oldModel.title,
        uid: oldModel.uid,
        id: oldModel.id,
        meta: oldModel.meta,
        body: new SceneGridLayout({
            isLazy: true,
            children: createSceneObjectsForPanels(oldModel.panels),
        }),
        $timeRange: new SceneTimeRange({
            from: oldModel.time.from,
            to: oldModel.time.to,
            fiscalYearStartMonth: oldModel.fiscalYearStartMonth,
            timeZone: oldModel.timezone,
            weekStart: oldModel.weekStart,
        }),
        $variables: variables,
        $behaviors: [
            new behaviors.CursorSync({
                sync: oldModel.graphTooltip,
            }),
        ],
        $data: layers.length > 0
            ? new SceneDataLayers({
                layers,
            })
            : undefined,
        controls: controls,
    });
}
export function createSceneVariableFromVariableModel(variable) {
    const commonProperties = {
        name: variable.name,
        label: variable.label,
    };
    if (isCustomVariable(variable)) {
        return new CustomVariable(Object.assign(Object.assign({}, commonProperties), { value: variable.current.value, text: variable.current.text, description: variable.description, query: variable.query, isMulti: variable.multi, allValue: variable.allValue || undefined, includeAll: variable.includeAll, defaultToAll: Boolean(variable.includeAll), skipUrlSync: variable.skipUrlSync, hide: variable.hide }));
    }
    else if (isQueryVariable(variable)) {
        return new QueryVariable(Object.assign(Object.assign({}, commonProperties), { value: variable.current.value, text: variable.current.text, description: variable.description, query: variable.query, datasource: variable.datasource, sort: variable.sort, refresh: variable.refresh, regex: variable.regex, allValue: variable.allValue || undefined, includeAll: variable.includeAll, defaultToAll: Boolean(variable.includeAll), isMulti: variable.multi, skipUrlSync: variable.skipUrlSync, hide: variable.hide }));
    }
    else if (isDataSourceVariable(variable)) {
        return new DataSourceVariable(Object.assign(Object.assign({}, commonProperties), { value: variable.current.value, text: variable.current.text, description: variable.description, regex: variable.regex, pluginId: variable.query, allValue: variable.allValue || undefined, includeAll: variable.includeAll, defaultToAll: Boolean(variable.includeAll), skipUrlSync: variable.skipUrlSync, isMulti: variable.multi, hide: variable.hide }));
    }
    else if (isIntervalVariable(variable)) {
        const intervals = getIntervalsFromOldIntervalModel(variable);
        const currentInterval = getCurrentValueForOldIntervalModel(variable, intervals);
        return new IntervalVariable(Object.assign(Object.assign({}, commonProperties), { value: currentInterval, description: variable.description, intervals: intervals, autoEnabled: variable.auto, autoStepCount: variable.auto_count, autoMinInterval: variable.auto_min, refresh: variable.refresh, skipUrlSync: variable.skipUrlSync, hide: variable.hide }));
    }
    else if (isConstantVariable(variable)) {
        return new ConstantVariable(Object.assign(Object.assign({}, commonProperties), { description: variable.description, value: variable.query, skipUrlSync: variable.skipUrlSync, hide: variable.hide }));
    }
    else {
        throw new Error(`Scenes: Unsupported variable type ${variable.type}`);
    }
}
export function buildGridItemForLibPanel(panel) {
    if (!panel.libraryPanel) {
        return null;
    }
    return new SceneGridItem({
        body: new LibraryVizPanel({
            title: panel.title,
            uid: panel.libraryPanel.uid,
            name: panel.libraryPanel.name,
            key: getVizPanelKeyForPanelId(panel.id),
        }),
        y: panel.gridPos.y,
        x: panel.gridPos.x,
        width: panel.gridPos.w,
        height: panel.gridPos.h,
    });
}
export function buildGridItemForPanel(panel) {
    var _a, _b;
    const vizPanelState = {
        key: getVizPanelKeyForPanelId(panel.id),
        title: panel.title,
        pluginId: panel.type,
        options: (_a = panel.options) !== null && _a !== void 0 ? _a : {},
        fieldConfig: panel.fieldConfig,
        pluginVersion: panel.pluginVersion,
        displayMode: panel.transparent ? 'transparent' : undefined,
        // To be replaced with it's own option persited option instead derived
        hoverHeader: !panel.title && !panel.timeFrom && !panel.timeShift,
        $data: createPanelDataProvider(panel),
        menu: new VizPanelMenu({
            $behaviors: [panelMenuBehavior],
        }),
        extendPanelContext: setDashboardPanelContext,
        _UNSAFE_customMigrationHandler: getAngularPanelMigrationHandler(panel),
    };
    if (panel.timeFrom || panel.timeShift) {
        vizPanelState.$timeRange = new PanelTimeRange({
            timeFrom: panel.timeFrom,
            timeShift: panel.timeShift,
            hideTimeOverride: panel.hideTimeOverride,
        });
    }
    if (panel.repeat) {
        const repeatDirection = (_b = panel.repeatDirection) !== null && _b !== void 0 ? _b : 'h';
        return new PanelRepeaterGridItem({
            key: `grid-item-${panel.id}`,
            x: panel.gridPos.x,
            y: panel.gridPos.y,
            width: repeatDirection === 'h' ? 24 : panel.gridPos.w,
            height: panel.gridPos.h,
            itemHeight: panel.gridPos.h,
            source: new VizPanel(vizPanelState),
            variableName: panel.repeat,
            repeatedPanels: [],
            repeatDirection: panel.repeatDirection,
            maxPerRow: panel.maxPerRow,
        });
    }
    return new SceneGridItem({
        key: `grid-item-${panel.id}`,
        x: panel.gridPos.x,
        y: panel.gridPos.y,
        width: panel.gridPos.w,
        height: panel.gridPos.h,
        body: new VizPanel(vizPanelState),
    });
}
const isCustomVariable = (v) => v.type === 'custom';
const isQueryVariable = (v) => v.type === 'query';
const isDataSourceVariable = (v) => v.type === 'datasource';
const isConstantVariable = (v) => v.type === 'constant';
const isIntervalVariable = (v) => v.type === 'interval';
const isAdhocVariable = (v) => v.type === 'adhoc';
//# sourceMappingURL=transformSaveModelToScene.js.map