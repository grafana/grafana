import * as tslib_1 from "tslib";
import config from 'app/core/config';
import _ from 'lodash';
var DashboardExporter = /** @class */ (function () {
    function DashboardExporter(datasourceSrv) {
        this.datasourceSrv = datasourceSrv;
    }
    DashboardExporter.prototype.makeExportable = function (dashboard) {
        var _this = this;
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
        try {
            for (var _f = tslib_1.__values(saveModel.templating.list), _g = _f.next(); !_g.done; _g = _f.next()) {
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
            if (datasource && datasource.indexOf('$') === 0) {
                datasourceVariable = variableLookup[datasource.substring(1)];
                if (datasourceVariable && datasourceVariable.current) {
                    datasource = datasourceVariable.current.value;
                }
            }
            promises.push(_this.datasourceSrv.get(datasource).then(function (ds) {
                if (ds.meta.builtIn) {
                    return;
                }
                // add data source type to require list
                requires['datasource' + ds.meta.id] = {
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
                    pluginId: ds.meta.id,
                    pluginName: ds.meta.name,
                };
                obj.datasource = '${' + refName + '}';
            }));
        };
        var processPanel = function (panel) {
            var e_6, _a;
            if (panel.datasource !== undefined) {
                templateizeDatasourceUsage(panel);
            }
            if (panel.targets) {
                try {
                    for (var _b = tslib_1.__values(panel.targets), _c = _b.next(); !_c.done; _c = _b.next()) {
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
        try {
            // check up panel data sources
            for (var _h = tslib_1.__values(saveModel.panels), _j = _h.next(); !_j.done; _j = _h.next()) {
                var panel = _j.value;
                processPanel(panel);
                // handle collapsed rows
                if (panel.collapsed !== undefined && panel.collapsed === true && panel.panels) {
                    try {
                        for (var _k = tslib_1.__values(panel.panels), _l = _k.next(); !_l.done; _l = _k.next()) {
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
            for (var _m = tslib_1.__values(saveModel.templating.list), _o = _m.next(); !_o.done; _o = _m.next()) {
                var variable = _o.value;
                if (variable.type === 'query') {
                    templateizeDatasourceUsage(variable);
                    variable.options = [];
                    variable.current = {};
                    variable.refresh = variable.refresh > 0 ? variable.refresh : 1;
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
            for (var _p = tslib_1.__values(saveModel.annotations.list), _q = _p.next(); !_q.done; _q = _p.next()) {
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
            var e_7, _a;
            _.each(datasources, function (value, key) {
                inputs.push(value);
            });
            try {
                // templatize constants
                for (var _b = tslib_1.__values(saveModel.templating.list), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var variable = _c.value;
                    if (variable.type === 'constant') {
                        var refName = 'VAR_' + variable.name.replace(' ', '_').toUpperCase();
                        inputs.push({
                            name: refName,
                            type: 'constant',
                            label: variable.label || variable.name,
                            value: variable.current.value,
                            description: '',
                        });
                        // update current and option
                        variable.query = '${' + refName + '}';
                        variable.options[0] = variable.current = {
                            value: variable.query,
                            text: variable.query,
                        };
                    }
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_7) throw e_7.error; }
            }
            // make inputs and requires a top thing
            var newObj = {};
            newObj['__inputs'] = inputs;
            newObj['__requires'] = _.sortBy(requires, ['id']);
            _.defaults(newObj, saveModel);
            return newObj;
        })
            .catch(function (err) {
            console.log('Export failed:', err);
            return {
                error: err,
            };
        });
    };
    return DashboardExporter;
}());
export { DashboardExporter };
//# sourceMappingURL=DashboardExporter.js.map