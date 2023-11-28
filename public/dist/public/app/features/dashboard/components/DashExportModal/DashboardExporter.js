import { __awaiter, __rest } from "tslib";
import { defaults, each, sortBy } from 'lodash';
import { getDataSourceSrv } from '@grafana/runtime';
import config from 'app/core/config';
import { getLibraryPanel } from 'app/features/library-panels/state/api';
import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
import { LibraryElementKind } from '../../../library-panels/types';
import { isConstant, isQuery } from '../../../variables/guard';
import { VariableRefresh } from '../../../variables/types';
function isExportableLibraryPanel(p) {
    return p.libraryPanel && typeof p.libraryPanel.name === 'string' && typeof p.libraryPanel.uid === 'string';
}
export class DashboardExporter {
    makeExportable(dashboard) {
        return __awaiter(this, void 0, void 0, function* () {
            // clean up repeated rows and panels,
            // this is done on the live real dashboard instance, not on a clone
            // so we need to undo this
            // this is pretty hacky and needs to be changed
            dashboard.cleanUpRepeats();
            const saveModel = dashboard.getSaveModelCloneOld();
            saveModel.id = null;
            // undo repeat cleanup
            dashboard.processRepeats();
            const inputs = [];
            const requires = {};
            const datasources = {};
            const variableLookup = {};
            const libraryPanels = new Map();
            for (const variable of saveModel.getVariables()) {
                variableLookup[variable.name] = variable;
            }
            const templateizeDatasourceUsage = (obj, fallback) => {
                if (obj.datasource === undefined) {
                    obj.datasource = fallback;
                    return;
                }
                let datasource = obj.datasource;
                let datasourceVariable = null;
                const datasourceUid = datasource === null || datasource === void 0 ? void 0 : datasource.uid;
                // ignore data source properties that contain a variable
                if (datasourceUid) {
                    if (datasourceUid.indexOf('$') === 0) {
                        datasourceVariable = variableLookup[datasourceUid.substring(1)];
                        if (datasourceVariable && datasourceVariable.current) {
                            datasource = datasourceVariable.current.value;
                        }
                    }
                }
                return getDataSourceSrv()
                    .get(datasource)
                    .then((ds) => {
                    var _a, _b, _c, _d, _e, _f, _g;
                    if ((_a = ds.meta) === null || _a === void 0 ? void 0 : _a.builtIn) {
                        return;
                    }
                    // add data source type to require list
                    requires['datasource' + ((_b = ds.meta) === null || _b === void 0 ? void 0 : _b.id)] = {
                        type: 'datasource',
                        id: ds.meta.id,
                        name: ds.meta.name,
                        version: ds.meta.info.version || '1.0.0',
                    };
                    // if used via variable we can skip templatizing usage
                    if (datasourceVariable) {
                        return;
                    }
                    const libraryPanel = obj.libraryPanel;
                    const libraryPanelSuffix = !!libraryPanel ? '-for-library-panel' : '';
                    let refName = 'DS_' + ds.name.replace(' ', '_').toUpperCase() + libraryPanelSuffix.toUpperCase();
                    datasources[refName] = {
                        name: refName,
                        label: ds.name,
                        description: '',
                        type: 'datasource',
                        pluginId: (_c = ds.meta) === null || _c === void 0 ? void 0 : _c.id,
                        pluginName: (_d = ds.meta) === null || _d === void 0 ? void 0 : _d.name,
                        usage: (_e = datasources[refName]) === null || _e === void 0 ? void 0 : _e.usage,
                    };
                    if (!!libraryPanel) {
                        const libPanels = ((_g = (_f = datasources[refName]) === null || _f === void 0 ? void 0 : _f.usage) === null || _g === void 0 ? void 0 : _g.libraryPanels) || [];
                        libPanels.push({ name: libraryPanel.name, uid: libraryPanel.uid });
                        datasources[refName].usage = {
                            libraryPanels: libPanels,
                        };
                    }
                    obj.datasource = { type: ds.meta.id, uid: '${' + refName + '}' };
                });
            };
            const processPanel = (panel) => __awaiter(this, void 0, void 0, function* () {
                if (panel.type !== 'row') {
                    yield templateizeDatasourceUsage(panel);
                    if (panel.targets) {
                        for (const target of panel.targets) {
                            yield templateizeDatasourceUsage(target, panel.datasource);
                        }
                    }
                    const panelDef = config.panels[panel.type];
                    if (panelDef) {
                        requires['panel' + panelDef.id] = {
                            type: 'panel',
                            id: panelDef.id,
                            name: panelDef.name,
                            version: panelDef.info.version,
                        };
                    }
                }
            });
            const processLibraryPanels = (panel) => __awaiter(this, void 0, void 0, function* () {
                if (isPanelModelLibraryPanel(panel)) {
                    const { name, uid } = panel.libraryPanel;
                    let model = panel.libraryPanel.model;
                    if (!model) {
                        const libPanel = yield getLibraryPanel(uid, true);
                        model = libPanel.model;
                    }
                    yield templateizeDatasourceUsage(model);
                    const _a = model, { gridPos, id } = _a, rest = __rest(_a, ["gridPos", "id"]);
                    if (!libraryPanels.has(uid)) {
                        libraryPanels.set(uid, { name, uid, kind: LibraryElementKind.Panel, model: rest });
                    }
                }
            });
            try {
                // check up panel data sources
                for (const panel of saveModel.panels) {
                    yield processPanel(panel);
                    // handle collapsed rows
                    if (panel.collapsed !== undefined && panel.collapsed === true && panel.panels) {
                        for (const rowPanel of panel.panels) {
                            yield processPanel(rowPanel);
                        }
                    }
                }
                // templatize template vars
                for (const variable of saveModel.getVariables()) {
                    if (isQuery(variable)) {
                        yield templateizeDatasourceUsage(variable);
                        variable.options = [];
                        variable.current = {};
                        variable.refresh =
                            variable.refresh !== VariableRefresh.never ? variable.refresh : VariableRefresh.onDashboardLoad;
                    }
                }
                // templatize annotations vars
                for (const annotationDef of saveModel.annotations.list) {
                    yield templateizeDatasourceUsage(annotationDef);
                }
                // add grafana version
                requires['grafana'] = {
                    type: 'grafana',
                    id: 'grafana',
                    name: 'Grafana',
                    version: config.buildInfo.version,
                };
                // we need to process all panels again after all the promises are resolved
                // so all data sources, variables and targets have been templateized when we process library panels
                for (const panel of saveModel.panels) {
                    yield processLibraryPanels(panel);
                    if (panel.collapsed !== undefined && panel.collapsed === true && panel.panels) {
                        for (const rowPanel of panel.panels) {
                            yield processLibraryPanels(rowPanel);
                        }
                    }
                }
                each(datasources, (value) => {
                    inputs.push(value);
                });
                // templatize constants
                for (const variable of saveModel.getVariables()) {
                    if (isConstant(variable)) {
                        const refName = 'VAR_' + variable.name.replace(' ', '_').toUpperCase();
                        inputs.push({
                            name: refName,
                            type: 'constant',
                            label: variable.label || variable.name,
                            value: variable.query,
                            description: '',
                        });
                        // update current and option
                        variable.query = '${' + refName + '}';
                        variable.current = {
                            value: variable.query,
                            text: variable.query,
                            selected: false,
                        };
                        variable.options = [variable.current];
                    }
                }
                const __elements = [...libraryPanels.entries()].reduce((prev, [curKey, curLibPanel]) => {
                    prev[curKey] = curLibPanel;
                    return prev;
                }, {});
                // make inputs and requires a top thing
                const newObj = defaults({
                    __inputs: inputs,
                    __elements,
                    __requires: sortBy(requires, ['id']),
                }, saveModel);
                // Remove extraneous props from library panels
                for (let i = 0; i < newObj.panels.length; i++) {
                    const libPanel = newObj.panels[i];
                    if (isExportableLibraryPanel(libPanel)) {
                        newObj.panels[i] = {
                            gridPos: libPanel.gridPos,
                            id: libPanel.id,
                            libraryPanel: { uid: libPanel.libraryPanel.uid, name: libPanel.libraryPanel.name },
                        };
                    }
                }
                return newObj;
            }
            catch (err) {
                console.error('Export failed:', err);
                return {
                    error: err,
                };
            }
        });
    }
}
//# sourceMappingURL=DashboardExporter.js.map