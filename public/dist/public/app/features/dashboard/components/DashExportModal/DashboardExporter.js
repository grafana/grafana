import { __read, __rest, __spreadArray, __values } from "tslib";
import { defaults, each, sortBy } from 'lodash';
import config from 'app/core/config';
import { getDataSourceSrv } from '@grafana/runtime';
import { VariableRefresh } from '../../../variables/types';
import { isConstant, isQuery } from '../../../variables/guard';
import { LibraryElementKind } from '../../../library-panels/types';
import { isPanelModelLibraryPanel } from '../../../library-panels/guard';
var DashboardExporter = /** @class */ (function () {
    function DashboardExporter() {
    }
    DashboardExporter.prototype.makeExportable = function (dashboard) {
        var e_1, _a, e_2, _b, e_3, _c, e_4, _d, e_5, _e;
        // clean up repeated rows and panels,
        // this is done on the live real dashboard instance, not on a clone
        // so we need to undo this
        // this is pretty hacky and needs to be changed
        dashboard.cleanUpRepeats();
        var saveModel = dashboard.getSaveModelClone();
        saveModel.id = null;
        // undo repeat cleanup
        dashboard.processRepeats();
        var inputs = [];
        var requires = {};
        var datasources = {};
        var promises = [];
        var variableLookup = {};
        var libraryPanels = new Map();
        try {
            for (var _f = __values(saveModel.getVariables()), _g = _f.next(); !_g.done; _g = _f.next()) {
                var variable = _g.value;
                variableLookup[variable.name] = variable;
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_g && !_g.done && (_a = _f.return)) _a.call(_f);
            }
            finally { if (e_1) throw e_1.error; }
        }
        var templateizeDatasourceUsage = function (obj) {
            var datasource = obj.datasource;
            var datasourceVariable = null;
            // ignore data source properties that contain a variable
            if (datasource && datasource.uid) {
                var uid = datasource.uid;
                if (uid.indexOf('$') === 0) {
                    datasourceVariable = variableLookup[uid.substring(1)];
                    if (datasourceVariable && datasourceVariable.current) {
                        datasource = datasourceVariable.current.value;
                    }
                }
            }
            promises.push(getDataSourceSrv()
                .get(datasource)
                .then(function (ds) {
                var _a, _b, _c, _d;
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
                var refName = 'DS_' + ds.name.replace(' ', '_').toUpperCase();
                datasources[refName] = {
                    name: refName,
                    label: ds.name,
                    description: '',
                    type: 'datasource',
                    pluginId: (_c = ds.meta) === null || _c === void 0 ? void 0 : _c.id,
                    pluginName: (_d = ds.meta) === null || _d === void 0 ? void 0 : _d.name,
                };
                obj.datasource = '${' + refName + '}';
            }));
        };
        var processPanel = function (panel) {
            var e_6, _a;
            if (panel.datasource !== undefined && panel.datasource !== null) {
                templateizeDatasourceUsage(panel);
            }
            if (panel.targets) {
                try {
                    for (var _b = __values(panel.targets), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var target = _c.value;
                        if (target.datasource !== undefined) {
                            templateizeDatasourceUsage(target);
                        }
                    }
                }
                catch (e_6_1) { e_6 = { error: e_6_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_6) throw e_6.error; }
                }
            }
            var panelDef = config.panels[panel.type];
            if (panelDef) {
                requires['panel' + panelDef.id] = {
                    type: 'panel',
                    id: panelDef.id,
                    name: panelDef.name,
                    version: panelDef.info.version,
                };
            }
        };
        var processLibraryPanels = function (panel) {
            if (isPanelModelLibraryPanel(panel)) {
                var libraryPanel = panel.libraryPanel, model = __rest(panel, ["libraryPanel"]);
                var name_1 = libraryPanel.name, uid = libraryPanel.uid;
                if (!libraryPanels.has(uid)) {
                    libraryPanels.set(uid, { name: name_1, uid: uid, kind: LibraryElementKind.Panel, model: model });
                }
            }
        };
        try {
            // check up panel data sources
            for (var _h = __values(saveModel.panels), _j = _h.next(); !_j.done; _j = _h.next()) {
                var panel = _j.value;
                processPanel(panel);
                // handle collapsed rows
                if (panel.collapsed !== undefined && panel.collapsed === true && panel.panels) {
                    try {
                        for (var _k = (e_3 = void 0, __values(panel.panels)), _l = _k.next(); !_l.done; _l = _k.next()) {
                            var rowPanel = _l.value;
                            processPanel(rowPanel);
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (_l && !_l.done && (_c = _k.return)) _c.call(_k);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_j && !_j.done && (_b = _h.return)) _b.call(_h);
            }
            finally { if (e_2) throw e_2.error; }
        }
        try {
            // templatize template vars
            for (var _m = __values(saveModel.getVariables()), _o = _m.next(); !_o.done; _o = _m.next()) {
                var variable = _o.value;
                if (isQuery(variable)) {
                    templateizeDatasourceUsage(variable);
                    variable.options = [];
                    variable.current = {};
                    variable.refresh =
                        variable.refresh !== VariableRefresh.never ? variable.refresh : VariableRefresh.onDashboardLoad;
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_o && !_o.done && (_d = _m.return)) _d.call(_m);
            }
            finally { if (e_4) throw e_4.error; }
        }
        try {
            // templatize annotations vars
            for (var _p = __values(saveModel.annotations.list), _q = _p.next(); !_q.done; _q = _p.next()) {
                var annotationDef = _q.value;
                templateizeDatasourceUsage(annotationDef);
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_q && !_q.done && (_e = _p.return)) _e.call(_p);
            }
            finally { if (e_5) throw e_5.error; }
        }
        // add grafana version
        requires['grafana'] = {
            type: 'grafana',
            id: 'grafana',
            name: 'Grafana',
            version: config.buildInfo.version,
        };
        return Promise.all(promises)
            .then(function () {
            var e_7, _a, e_8, _b, e_9, _c;
            each(datasources, function (value) {
                inputs.push(value);
            });
            try {
                // we need to process all panels again after all the promises are resolved
                // so all data sources, variables and targets have been templateized when we process library panels
                for (var _d = __values(saveModel.panels), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var panel = _e.value;
                    processLibraryPanels(panel);
                    if (panel.collapsed !== undefined && panel.collapsed === true && panel.panels) {
                        try {
                            for (var _f = (e_8 = void 0, __values(panel.panels)), _g = _f.next(); !_g.done; _g = _f.next()) {
                                var rowPanel = _g.value;
                                processLibraryPanels(rowPanel);
                            }
                        }
                        catch (e_8_1) { e_8 = { error: e_8_1 }; }
                        finally {
                            try {
                                if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
                            }
                            finally { if (e_8) throw e_8.error; }
                        }
                    }
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                }
                finally { if (e_7) throw e_7.error; }
            }
            try {
                // templatize constants
                for (var _h = __values(saveModel.getVariables()), _j = _h.next(); !_j.done; _j = _h.next()) {
                    var variable = _j.value;
                    if (isConstant(variable)) {
                        var refName = 'VAR_' + variable.name.replace(' ', '_').toUpperCase();
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
            }
            catch (e_9_1) { e_9 = { error: e_9_1 }; }
            finally {
                try {
                    if (_j && !_j.done && (_c = _h.return)) _c.call(_h);
                }
                finally { if (e_9) throw e_9.error; }
            }
            // make inputs and requires a top thing
            var newObj = {};
            newObj['__inputs'] = inputs;
            newObj['__elements'] = __spreadArray([], __read(libraryPanels.values()), false);
            newObj['__requires'] = sortBy(requires, ['id']);
            defaults(newObj, saveModel);
            return newObj;
        })
            .catch(function (err) {
            console.error('Export failed:', err);
            return {
                error: err,
            };
        });
    };
    return DashboardExporter;
}());
export { DashboardExporter };
//# sourceMappingURL=DashboardExporter.js.map