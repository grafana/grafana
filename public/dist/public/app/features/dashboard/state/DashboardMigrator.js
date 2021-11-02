import { __assign, __read, __spreadArray, __values } from "tslib";
// Libraries
import { each, find, findIndex, flattenDeep, isArray, isBoolean, isNumber, isString, map, max, some } from 'lodash';
// Utils
import getFactors from 'app/core/utils/factors';
import kbn from 'app/core/utils/kbn';
// Types
import { PanelModel } from './PanelModel';
import { DataLinkBuiltInVars, MappingType, SpecialValueMatch, standardEditorsRegistry, standardFieldConfigEditorRegistry, urlUtil, getActiveThreshold, } from '@grafana/data';
// Constants
import { DEFAULT_PANEL_SPAN, DEFAULT_ROW_HEIGHT, GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT, MIN_PANEL_HEIGHT, } from 'app/core/constants';
import { isConstant, isMulti } from 'app/features/variables/guard';
import { alignCurrentWithMulti } from 'app/features/variables/shared/multiOptions';
import { VariableHide } from '../../variables/types';
import { config } from 'app/core/config';
import { plugin as statPanelPlugin } from 'app/plugins/panel/stat/module';
import { plugin as gaugePanelPlugin } from 'app/plugins/panel/gauge/module';
import { getStandardFieldConfigs, getStandardOptionEditors } from '@grafana/ui';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { getDataSourceSrv } from '@grafana/runtime';
import { labelsToFieldsTransformer } from '../../../../../packages/grafana-data/src/transformations/transformers/labelsToFields';
import { mergeTransformer } from '../../../../../packages/grafana-data/src/transformations/transformers/merge';
import { migrateMultipleStatsMetricsQuery, migrateMultipleStatsAnnotationQuery, } from 'app/plugins/datasource/cloudwatch/migrations';
standardEditorsRegistry.setInit(getStandardOptionEditors);
standardFieldConfigEditorRegistry.setInit(getStandardFieldConfigs);
var DashboardMigrator = /** @class */ (function () {
    function DashboardMigrator(dashboardModel) {
        this.dashboard = dashboardModel;
    }
    DashboardMigrator.prototype.updateSchema = function (old) {
        var e_1, _a, e_2, _b, e_3, _c, e_4, _d, e_5, _e, e_6, _f, e_7, _g, e_8, _h;
        var _this = this;
        var _j, _k, _l;
        var i, j, k, n;
        var oldVersion = this.dashboard.schemaVersion;
        var panelUpgrades = [];
        this.dashboard.schemaVersion = 33;
        if (oldVersion === this.dashboard.schemaVersion) {
            return;
        }
        // version 2 schema changes
        if (oldVersion < 2) {
            if (old.services) {
                if (old.services.filter) {
                    this.dashboard.time = old.services.filter.time;
                    this.dashboard.templating.list = old.services.filter.list || [];
                }
            }
            panelUpgrades.push(function (panel) {
                // rename panel type
                if (panel.type === 'graphite') {
                    panel.type = 'graph';
                }
                if (panel.type !== 'graph') {
                    return panel;
                }
                if (isBoolean(panel.legend)) {
                    panel.legend = { show: panel.legend };
                }
                if (panel.grid) {
                    if (panel.grid.min) {
                        panel.grid.leftMin = panel.grid.min;
                        delete panel.grid.min;
                    }
                    if (panel.grid.max) {
                        panel.grid.leftMax = panel.grid.max;
                        delete panel.grid.max;
                    }
                }
                if (panel.y_format) {
                    if (!panel.y_formats) {
                        panel.y_formats = [];
                    }
                    panel.y_formats[0] = panel.y_format;
                    delete panel.y_format;
                }
                if (panel.y2_format) {
                    if (!panel.y_formats) {
                        panel.y_formats = [];
                    }
                    panel.y_formats[1] = panel.y2_format;
                    delete panel.y2_format;
                }
                return panel;
            });
        }
        // schema version 3 changes
        if (oldVersion < 3) {
            // ensure panel IDs
            var maxId_1 = this.dashboard.getNextPanelId();
            panelUpgrades.push(function (panel) {
                if (!panel.id) {
                    panel.id = maxId_1;
                    maxId_1 += 1;
                }
                return panel;
            });
        }
        // schema version 4 changes
        if (oldVersion < 4) {
            // move aliasYAxis changes
            panelUpgrades.push(function (panel) {
                if (panel.type !== 'graph') {
                    return panel;
                }
                each(panel.aliasYAxis, function (value, key) {
                    panel.seriesOverrides = [{ alias: key, yaxis: value }];
                });
                delete panel.aliasYAxis;
                return panel;
            });
        }
        if (oldVersion < 6) {
            // move drop-downs to new schema
            var annotations = find(old.pulldowns, { type: 'annotations' });
            if (annotations) {
                this.dashboard.annotations = {
                    list: annotations.annotations || [],
                };
            }
            // update template variables
            for (i = 0; i < this.dashboard.templating.list.length; i++) {
                var variable = this.dashboard.templating.list[i];
                if (variable.datasource === void 0) {
                    variable.datasource = null;
                }
                if (variable.type === 'filter') {
                    variable.type = 'query';
                }
                if (variable.type === void 0) {
                    variable.type = 'query';
                }
                if (variable.allFormat === void 0) {
                    variable.allFormat = 'glob';
                }
            }
        }
        if (oldVersion < 7) {
            if (old.nav && old.nav.length) {
                this.dashboard.timepicker = old.nav[0];
            }
            // ensure query refIds
            panelUpgrades.push(function (panel) {
                each(panel.targets, function (target) {
                    if (!target.refId) {
                        target.refId = panel.getNextQueryLetter && panel.getNextQueryLetter();
                    }
                });
                return panel;
            });
        }
        if (oldVersion < 8) {
            panelUpgrades.push(function (panel) {
                each(panel.targets, function (target) {
                    // update old influxdb query schema
                    if (target.fields && target.tags && target.groupBy) {
                        if (target.rawQuery) {
                            delete target.fields;
                            delete target.fill;
                        }
                        else {
                            target.select = map(target.fields, function (field) {
                                var parts = [];
                                parts.push({ type: 'field', params: [field.name] });
                                parts.push({ type: field.func, params: [] });
                                if (field.mathExpr) {
                                    parts.push({ type: 'math', params: [field.mathExpr] });
                                }
                                if (field.asExpr) {
                                    parts.push({ type: 'alias', params: [field.asExpr] });
                                }
                                return parts;
                            });
                            delete target.fields;
                            each(target.groupBy, function (part) {
                                if (part.type === 'time' && part.interval) {
                                    part.params = [part.interval];
                                    delete part.interval;
                                }
                                if (part.type === 'tag' && part.key) {
                                    part.params = [part.key];
                                    delete part.key;
                                }
                            });
                            if (target.fill) {
                                target.groupBy.push({ type: 'fill', params: [target.fill] });
                                delete target.fill;
                            }
                        }
                    }
                });
                return panel;
            });
        }
        // schema version 9 changes
        if (oldVersion < 9) {
            // move aliasYAxis changes
            panelUpgrades.push(function (panel) {
                if (panel.type !== 'singlestat' && panel.thresholds !== '') {
                    return panel;
                }
                if (panel.thresholds) {
                    var k_1 = panel.thresholds.split(',');
                    if (k_1.length >= 3) {
                        k_1.shift();
                        panel.thresholds = k_1.join(',');
                    }
                }
                return panel;
            });
        }
        // schema version 10 changes
        if (oldVersion < 10) {
            // move aliasYAxis changes
            panelUpgrades.push(function (panel) {
                if (panel.type !== 'table') {
                    return panel;
                }
                each(panel.styles, function (style) {
                    if (style.thresholds && style.thresholds.length >= 3) {
                        var k_2 = style.thresholds;
                        k_2.shift();
                        style.thresholds = k_2;
                    }
                });
                return panel;
            });
        }
        if (oldVersion < 12) {
            // update template variables
            each(this.dashboard.getVariables(), function (templateVariable) {
                if (templateVariable.refresh) {
                    templateVariable.refresh = 1;
                }
                if (!templateVariable.refresh) {
                    templateVariable.refresh = 0;
                }
                if (templateVariable.hideVariable) {
                    templateVariable.hide = 2;
                }
                else if (templateVariable.hideLabel) {
                    templateVariable.hide = 1;
                }
            });
        }
        if (oldVersion < 12) {
            // update graph yaxes changes
            panelUpgrades.push(function (panel) {
                if (panel.type !== 'graph') {
                    return panel;
                }
                if (!panel.grid) {
                    return panel;
                }
                if (!panel.yaxes) {
                    panel.yaxes = [
                        {
                            show: panel['y-axis'],
                            min: panel.grid.leftMin,
                            max: panel.grid.leftMax,
                            logBase: panel.grid.leftLogBase,
                            format: panel.y_formats[0],
                            label: panel.leftYAxisLabel,
                        },
                        {
                            show: panel['y-axis'],
                            min: panel.grid.rightMin,
                            max: panel.grid.rightMax,
                            logBase: panel.grid.rightLogBase,
                            format: panel.y_formats[1],
                            label: panel.rightYAxisLabel,
                        },
                    ];
                    panel.xaxis = {
                        show: panel['x-axis'],
                    };
                    delete panel.grid.leftMin;
                    delete panel.grid.leftMax;
                    delete panel.grid.leftLogBase;
                    delete panel.grid.rightMin;
                    delete panel.grid.rightMax;
                    delete panel.grid.rightLogBase;
                    delete panel.y_formats;
                    delete panel.leftYAxisLabel;
                    delete panel.rightYAxisLabel;
                    delete panel['y-axis'];
                    delete panel['x-axis'];
                }
                return panel;
            });
        }
        if (oldVersion < 13) {
            // update graph yaxes changes
            panelUpgrades.push(function (panel) {
                if (panel.type !== 'graph') {
                    return panel;
                }
                if (!panel.grid) {
                    return panel;
                }
                if (!panel.thresholds) {
                    panel.thresholds = [];
                }
                var t1 = {}, t2 = {};
                if (panel.grid.threshold1 !== null) {
                    t1.value = panel.grid.threshold1;
                    if (panel.grid.thresholdLine) {
                        t1.line = true;
                        t1.lineColor = panel.grid.threshold1Color;
                        t1.colorMode = 'custom';
                    }
                    else {
                        t1.fill = true;
                        t1.fillColor = panel.grid.threshold1Color;
                        t1.colorMode = 'custom';
                    }
                }
                if (panel.grid.threshold2 !== null) {
                    t2.value = panel.grid.threshold2;
                    if (panel.grid.thresholdLine) {
                        t2.line = true;
                        t2.lineColor = panel.grid.threshold2Color;
                        t2.colorMode = 'custom';
                    }
                    else {
                        t2.fill = true;
                        t2.fillColor = panel.grid.threshold2Color;
                        t2.colorMode = 'custom';
                    }
                }
                if (isNumber(t1.value)) {
                    if (isNumber(t2.value)) {
                        if (t1.value > t2.value) {
                            t1.op = t2.op = 'lt';
                            panel.thresholds.push(t1);
                            panel.thresholds.push(t2);
                        }
                        else {
                            t1.op = t2.op = 'gt';
                            panel.thresholds.push(t1);
                            panel.thresholds.push(t2);
                        }
                    }
                    else {
                        t1.op = 'gt';
                        panel.thresholds.push(t1);
                    }
                }
                delete panel.grid.threshold1;
                delete panel.grid.threshold1Color;
                delete panel.grid.threshold2;
                delete panel.grid.threshold2Color;
                delete panel.grid.thresholdLine;
                return panel;
            });
        }
        if (oldVersion < 14) {
            this.dashboard.graphTooltip = old.sharedCrosshair ? 1 : 0;
        }
        if (oldVersion < 16) {
            this.upgradeToGridLayout(old);
        }
        if (oldVersion < 17) {
            panelUpgrades.push(function (panel) {
                if (panel.minSpan) {
                    var max_1 = GRID_COLUMN_COUNT / panel.minSpan;
                    var factors = getFactors(GRID_COLUMN_COUNT);
                    // find the best match compared to factors
                    // (ie. [1,2,3,4,6,12,24] for 24 columns)
                    panel.maxPerRow =
                        factors[findIndex(factors, function (o) {
                            return o > max_1;
                        }) - 1];
                }
                delete panel.minSpan;
                return panel;
            });
        }
        if (oldVersion < 18) {
            // migrate change to gauge options
            panelUpgrades.push(function (panel) {
                if (panel['options-gauge']) {
                    panel.options = panel['options-gauge'];
                    panel.options.valueOptions = {
                        unit: panel.options.unit,
                        stat: panel.options.stat,
                        decimals: panel.options.decimals,
                        prefix: panel.options.prefix,
                        suffix: panel.options.suffix,
                    };
                    // correct order
                    if (panel.options.thresholds) {
                        panel.options.thresholds.reverse();
                    }
                    // this options prop was due to a bug
                    delete panel.options.options;
                    delete panel.options.unit;
                    delete panel.options.stat;
                    delete panel.options.decimals;
                    delete panel.options.prefix;
                    delete panel.options.suffix;
                    delete panel['options-gauge'];
                }
                return panel;
            });
        }
        if (oldVersion < 19) {
            // migrate change to gauge options
            panelUpgrades.push(function (panel) {
                if (panel.links && isArray(panel.links)) {
                    panel.links = panel.links.map(upgradePanelLink);
                }
                return panel;
            });
        }
        if (oldVersion < 20) {
            var updateLinks_1 = function (link) {
                return __assign(__assign({}, link), { url: updateVariablesSyntax(link.url) });
            };
            panelUpgrades.push(function (panel) {
                // For graph panel
                if (panel.options && panel.options.dataLinks && isArray(panel.options.dataLinks)) {
                    panel.options.dataLinks = panel.options.dataLinks.map(updateLinks_1);
                }
                // For panel with fieldOptions
                if (panel.options && panel.options.fieldOptions && panel.options.fieldOptions.defaults) {
                    if (panel.options.fieldOptions.defaults.links && isArray(panel.options.fieldOptions.defaults.links)) {
                        panel.options.fieldOptions.defaults.links = panel.options.fieldOptions.defaults.links.map(updateLinks_1);
                    }
                    if (panel.options.fieldOptions.defaults.title) {
                        panel.options.fieldOptions.defaults.title = updateVariablesSyntax(panel.options.fieldOptions.defaults.title);
                    }
                }
                return panel;
            });
        }
        if (oldVersion < 21) {
            var updateLinks_2 = function (link) {
                return __assign(__assign({}, link), { url: link.url.replace(/__series.labels/g, '__field.labels') });
            };
            panelUpgrades.push(function (panel) {
                // For graph panel
                if (panel.options && panel.options.dataLinks && isArray(panel.options.dataLinks)) {
                    panel.options.dataLinks = panel.options.dataLinks.map(updateLinks_2);
                }
                // For panel with fieldOptions
                if (panel.options && panel.options.fieldOptions && panel.options.fieldOptions.defaults) {
                    if (panel.options.fieldOptions.defaults.links && isArray(panel.options.fieldOptions.defaults.links)) {
                        panel.options.fieldOptions.defaults.links = panel.options.fieldOptions.defaults.links.map(updateLinks_2);
                    }
                }
                return panel;
            });
        }
        if (oldVersion < 22) {
            panelUpgrades.push(function (panel) {
                if (panel.type !== 'table') {
                    return panel;
                }
                each(panel.styles, function (style) {
                    style.align = 'auto';
                });
                return panel;
            });
        }
        if (oldVersion < 23) {
            try {
                for (var _m = __values(this.dashboard.templating.list), _o = _m.next(); !_o.done; _o = _m.next()) {
                    var variable = _o.value;
                    if (!isMulti(variable)) {
                        continue;
                    }
                    var multi = variable.multi, current = variable.current;
                    variable.current = alignCurrentWithMulti(current, multi);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_o && !_o.done && (_a = _m.return)) _a.call(_m);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        if (oldVersion < 24) {
            // 7.0
            // - migrate existing tables to 'table-old'
            panelUpgrades.push(function (panel) {
                var wasAngularTable = panel.type === 'table';
                if (wasAngularTable && !panel.styles) {
                    return panel; // styles are missing so assumes default settings
                }
                var wasReactTable = panel.table === 'table2';
                if (!wasAngularTable || wasReactTable) {
                    return panel;
                }
                panel.type = wasAngularTable ? 'table-old' : 'table';
                return panel;
            });
        }
        if (oldVersion < 25) {
            // tags are removed in version 28
        }
        if (oldVersion < 26) {
            panelUpgrades.push(function (panel) {
                var wasReactText = panel.type === 'text2';
                if (!wasReactText) {
                    return panel;
                }
                panel.type = 'text';
                delete panel.options.angular;
                return panel;
            });
        }
        if (oldVersion < 27) {
            try {
                for (var _p = __values(this.dashboard.templating.list), _q = _p.next(); !_q.done; _q = _p.next()) {
                    var variable = _q.value;
                    if (!isConstant(variable)) {
                        continue;
                    }
                    if (variable.hide === VariableHide.dontHide || variable.hide === VariableHide.hideLabel) {
                        variable.type = 'textbox';
                    }
                    variable.current = { selected: true, text: (_j = variable.query) !== null && _j !== void 0 ? _j : '', value: (_k = variable.query) !== null && _k !== void 0 ? _k : '' };
                    variable.options = [variable.current];
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_q && !_q.done && (_b = _p.return)) _b.call(_p);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
        if (oldVersion < 28) {
            panelUpgrades.push(function (panel) {
                if (panel.type === 'singlestat') {
                    return migrateSinglestat(panel);
                }
                return panel;
            });
            try {
                for (var _r = __values(this.dashboard.templating.list), _s = _r.next(); !_s.done; _s = _r.next()) {
                    var variable = _s.value;
                    if (variable.tags) {
                        delete variable.tags;
                    }
                    if (variable.tagsQuery) {
                        delete variable.tagsQuery;
                    }
                    if (variable.tagValuesQuery) {
                        delete variable.tagValuesQuery;
                    }
                    if (variable.useTags) {
                        delete variable.useTags;
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_s && !_s.done && (_c = _r.return)) _c.call(_r);
                }
                finally { if (e_3) throw e_3.error; }
            }
        }
        if (oldVersion < 29) {
            try {
                for (var _t = __values(this.dashboard.templating.list), _u = _t.next(); !_u.done; _u = _t.next()) {
                    var variable = _u.value;
                    if (variable.type !== 'query') {
                        continue;
                    }
                    if (variable.refresh !== 1 && variable.refresh !== 2) {
                        variable.refresh = 1;
                    }
                    if ((_l = variable.options) === null || _l === void 0 ? void 0 : _l.length) {
                        variable.options = [];
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_u && !_u.done && (_d = _t.return)) _d.call(_t);
                }
                finally { if (e_4) throw e_4.error; }
            }
        }
        if (oldVersion < 30) {
            panelUpgrades.push(upgradeValueMappingsForPanel);
            panelUpgrades.push(migrateTooltipOptions);
        }
        if (oldVersion < 31) {
            panelUpgrades.push(function (panel) {
                var e_9, _a;
                if (panel.transformations) {
                    try {
                        for (var _b = __values(panel.transformations), _c = _b.next(); !_c.done; _c = _b.next()) {
                            var t = _c.value;
                            if (t.id === labelsToFieldsTransformer.id) {
                                return appendTransformerAfter(panel, labelsToFieldsTransformer.id, {
                                    id: mergeTransformer.id,
                                    options: {},
                                });
                            }
                        }
                    }
                    catch (e_9_1) { e_9 = { error: e_9_1 }; }
                    finally {
                        try {
                            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                        }
                        finally { if (e_9) throw e_9.error; }
                    }
                }
                return panel;
            });
        }
        if (oldVersion < 32) {
            panelUpgrades.push(function (panel) {
                _this.migrateCloudWatchQueries(panel);
                return panel;
            });
            this.migrateCloudWatchAnnotationQuery();
        }
        // Replace datasource name with reference, uid and type
        if (oldVersion < 33) {
            try {
                for (var _v = __values(this.dashboard.templating.list), _w = _v.next(); !_w.done; _w = _v.next()) {
                    var variable = _w.value;
                    if (variable.type !== 'query') {
                        continue;
                    }
                    var name_1 = variable.datasource;
                    if (name_1) {
                        variable.datasource = migrateDatasourceNameToRef(name_1);
                    }
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (_w && !_w.done && (_e = _v.return)) _e.call(_v);
                }
                finally { if (e_5) throw e_5.error; }
            }
            try {
                // Mutate panel models
                for (var _x = __values(this.dashboard.panels), _y = _x.next(); !_y.done; _y = _x.next()) {
                    var panel = _y.value;
                    var name_2 = panel.datasource;
                    if (!name_2) {
                        panel.datasource = null; // use default
                    }
                    else if (name_2 === MIXED_DATASOURCE_NAME) {
                        panel.datasource = { type: MIXED_DATASOURCE_NAME };
                        try {
                            for (var _z = (e_7 = void 0, __values(panel.targets)), _0 = _z.next(); !_0.done; _0 = _z.next()) {
                                var target = _0.value;
                                name_2 = target.datasource;
                                panel.datasource = migrateDatasourceNameToRef(name_2);
                            }
                        }
                        catch (e_7_1) { e_7 = { error: e_7_1 }; }
                        finally {
                            try {
                                if (_0 && !_0.done && (_g = _z.return)) _g.call(_z);
                            }
                            finally { if (e_7) throw e_7.error; }
                        }
                        continue; // do not cleanup targets
                    }
                    else {
                        panel.datasource = migrateDatasourceNameToRef(name_2);
                    }
                    // cleanup query datasource references
                    if (!panel.targets) {
                        panel.targets = [];
                    }
                    else {
                        try {
                            for (var _1 = (e_8 = void 0, __values(panel.targets)), _2 = _1.next(); !_2.done; _2 = _1.next()) {
                                var target = _2.value;
                                delete target.datasource;
                            }
                        }
                        catch (e_8_1) { e_8 = { error: e_8_1 }; }
                        finally {
                            try {
                                if (_2 && !_2.done && (_h = _1.return)) _h.call(_1);
                            }
                            finally { if (e_8) throw e_8.error; }
                        }
                    }
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (_y && !_y.done && (_f = _x.return)) _f.call(_x);
                }
                finally { if (e_6) throw e_6.error; }
            }
        }
        if (panelUpgrades.length === 0) {
            return;
        }
        for (j = 0; j < this.dashboard.panels.length; j++) {
            for (k = 0; k < panelUpgrades.length; k++) {
                this.dashboard.panels[j] = panelUpgrades[k].call(this, this.dashboard.panels[j]);
                if (this.dashboard.panels[j].panels) {
                    for (n = 0; n < this.dashboard.panels[j].panels.length; n++) {
                        this.dashboard.panels[j].panels[n] = panelUpgrades[k].call(this, this.dashboard.panels[j].panels[n]);
                    }
                }
            }
        }
    };
    // Migrates metric queries and/or annotation queries that use more than one statistic.
    // E.g query.statistics = ['Max', 'Min'] will be migrated to two queries - query1.statistic = 'Max' and query2.statistic = 'Min'
    // New queries, that were created during migration, are put at the end of the array.
    DashboardMigrator.prototype.migrateCloudWatchQueries = function (panel) {
        var e_10, _a, e_11, _b;
        try {
            for (var _c = __values(panel.targets || []), _d = _c.next(); !_d.done; _d = _c.next()) {
                var target = _d.value;
                if (isLegacyCloudWatchQuery(target)) {
                    var newQueries = migrateMultipleStatsMetricsQuery(target, __spreadArray([], __read(panel.targets), false));
                    try {
                        for (var newQueries_1 = (e_11 = void 0, __values(newQueries)), newQueries_1_1 = newQueries_1.next(); !newQueries_1_1.done; newQueries_1_1 = newQueries_1.next()) {
                            var newQuery = newQueries_1_1.value;
                            panel.targets.push(newQuery);
                        }
                    }
                    catch (e_11_1) { e_11 = { error: e_11_1 }; }
                    finally {
                        try {
                            if (newQueries_1_1 && !newQueries_1_1.done && (_b = newQueries_1.return)) _b.call(newQueries_1);
                        }
                        finally { if (e_11) throw e_11.error; }
                    }
                }
            }
        }
        catch (e_10_1) { e_10 = { error: e_10_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_10) throw e_10.error; }
        }
    };
    DashboardMigrator.prototype.migrateCloudWatchAnnotationQuery = function () {
        var e_12, _a, e_13, _b;
        try {
            for (var _c = __values(this.dashboard.annotations.list), _d = _c.next(); !_d.done; _d = _c.next()) {
                var annotation = _d.value;
                if (isLegacyCloudWatchAnnotationQuery(annotation)) {
                    var newAnnotationQueries = migrateMultipleStatsAnnotationQuery(annotation);
                    try {
                        for (var newAnnotationQueries_1 = (e_13 = void 0, __values(newAnnotationQueries)), newAnnotationQueries_1_1 = newAnnotationQueries_1.next(); !newAnnotationQueries_1_1.done; newAnnotationQueries_1_1 = newAnnotationQueries_1.next()) {
                            var newAnnotationQuery = newAnnotationQueries_1_1.value;
                            this.dashboard.annotations.list.push(newAnnotationQuery);
                        }
                    }
                    catch (e_13_1) { e_13 = { error: e_13_1 }; }
                    finally {
                        try {
                            if (newAnnotationQueries_1_1 && !newAnnotationQueries_1_1.done && (_b = newAnnotationQueries_1.return)) _b.call(newAnnotationQueries_1);
                        }
                        finally { if (e_13) throw e_13.error; }
                    }
                }
            }
        }
        catch (e_12_1) { e_12 = { error: e_12_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_12) throw e_12.error; }
        }
    };
    DashboardMigrator.prototype.upgradeToGridLayout = function (old) {
        var e_14, _a, e_15, _b;
        var yPos = 0;
        var widthFactor = GRID_COLUMN_COUNT / 12;
        var maxPanelId = max(flattenDeep(map(old.rows, function (row) {
            return map(row.panels, 'id');
        })));
        var nextRowId = maxPanelId + 1;
        if (!old.rows) {
            return;
        }
        // Add special "row" panels if even one row is collapsed, repeated or has visible title
        var showRows = some(old.rows, function (row) { return row.collapse || row.showTitle || row.repeat; });
        try {
            for (var _c = __values(old.rows), _d = _c.next(); !_d.done; _d = _c.next()) {
                var row = _d.value;
                if (row.repeatIteration) {
                    continue;
                }
                var height = row.height || DEFAULT_ROW_HEIGHT;
                var rowGridHeight = getGridHeight(height);
                var rowPanel = {};
                var rowPanelModel = void 0;
                if (showRows) {
                    // add special row panel
                    rowPanel.id = nextRowId;
                    rowPanel.type = 'row';
                    rowPanel.title = row.title;
                    rowPanel.collapsed = row.collapse;
                    rowPanel.repeat = row.repeat;
                    rowPanel.panels = [];
                    rowPanel.gridPos = {
                        x: 0,
                        y: yPos,
                        w: GRID_COLUMN_COUNT,
                        h: rowGridHeight,
                    };
                    rowPanelModel = new PanelModel(rowPanel);
                    nextRowId++;
                    yPos++;
                }
                var rowArea = new RowArea(rowGridHeight, GRID_COLUMN_COUNT, yPos);
                try {
                    for (var _e = (e_15 = void 0, __values(row.panels)), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var panel = _f.value;
                        panel.span = panel.span || DEFAULT_PANEL_SPAN;
                        if (panel.minSpan) {
                            panel.minSpan = Math.min(GRID_COLUMN_COUNT, (GRID_COLUMN_COUNT / 12) * panel.minSpan);
                        }
                        var panelWidth = Math.floor(panel.span) * widthFactor;
                        var panelHeight = panel.height ? getGridHeight(panel.height) : rowGridHeight;
                        var panelPos = rowArea.getPanelPosition(panelHeight, panelWidth);
                        yPos = rowArea.yPos;
                        panel.gridPos = {
                            x: panelPos.x,
                            y: yPos + panelPos.y,
                            w: panelWidth,
                            h: panelHeight,
                        };
                        rowArea.addPanel(panel.gridPos);
                        delete panel.span;
                        if (rowPanelModel && rowPanel.collapsed) {
                            rowPanelModel.panels.push(panel);
                        }
                        else {
                            this.dashboard.panels.push(new PanelModel(panel));
                        }
                    }
                }
                catch (e_15_1) { e_15 = { error: e_15_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_15) throw e_15.error; }
                }
                if (rowPanelModel) {
                    this.dashboard.panels.push(rowPanelModel);
                }
                if (!(rowPanelModel && rowPanel.collapsed)) {
                    yPos += rowGridHeight;
                }
            }
        }
        catch (e_14_1) { e_14 = { error: e_14_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_14) throw e_14.error; }
        }
    };
    return DashboardMigrator;
}());
export { DashboardMigrator };
function getGridHeight(height) {
    if (isString(height)) {
        height = parseInt(height.replace('px', ''), 10);
    }
    if (height < MIN_PANEL_HEIGHT) {
        height = MIN_PANEL_HEIGHT;
    }
    var gridHeight = Math.ceil(height / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN));
    return gridHeight;
}
/**
 * RowArea represents dashboard row filled by panels
 * area is an array of numbers represented filled column's cells like
 *  -----------------------
 * |******** ****
 * |******** ****
 * |********
 *  -----------------------
 *  33333333 2222 00000 ...
 */
var RowArea = /** @class */ (function () {
    function RowArea(height, width, rowYPos) {
        if (width === void 0) { width = GRID_COLUMN_COUNT; }
        if (rowYPos === void 0) { rowYPos = 0; }
        this.area = new Array(width).fill(0);
        this.yPos = rowYPos;
        this.height = height;
    }
    RowArea.prototype.reset = function () {
        this.area.fill(0);
    };
    /**
     * Update area after adding the panel.
     */
    RowArea.prototype.addPanel = function (gridPos) {
        for (var i = gridPos.x; i < gridPos.x + gridPos.w; i++) {
            if (!this.area[i] || gridPos.y + gridPos.h - this.yPos > this.area[i]) {
                this.area[i] = gridPos.y + gridPos.h - this.yPos;
            }
        }
        return this.area;
    };
    /**
     * Calculate position for the new panel in the row.
     */
    RowArea.prototype.getPanelPosition = function (panelHeight, panelWidth, callOnce) {
        if (callOnce === void 0) { callOnce = false; }
        var startPlace, endPlace;
        var place;
        for (var i = this.area.length - 1; i >= 0; i--) {
            if (this.height - this.area[i] > 0) {
                if (endPlace === undefined) {
                    endPlace = i;
                }
                else {
                    if (i < this.area.length - 1 && this.area[i] <= this.area[i + 1]) {
                        startPlace = i;
                    }
                    else {
                        break;
                    }
                }
            }
            else {
                break;
            }
        }
        if (startPlace !== undefined && endPlace !== undefined && endPlace - startPlace >= panelWidth - 1) {
            var yPos = max(this.area.slice(startPlace));
            place = {
                x: startPlace,
                y: yPos,
            };
        }
        else if (!callOnce) {
            // wrap to next row
            this.yPos += this.height;
            this.reset();
            return this.getPanelPosition(panelHeight, panelWidth, true);
        }
        else {
            return null;
        }
        return place;
    };
    return RowArea;
}());
function upgradePanelLink(link) {
    var url = link.url;
    if (!url && link.dashboard) {
        url = "dashboard/db/" + kbn.slugifyForUrl(link.dashboard);
    }
    if (!url && link.dashUri) {
        url = "dashboard/" + link.dashUri;
    }
    // some models are incomplete and have no dashboard or dashUri
    if (!url) {
        url = '/';
    }
    if (link.keepTime) {
        url = urlUtil.appendQueryToUrl(url, "$" + DataLinkBuiltInVars.keepTime);
    }
    if (link.includeVars) {
        url = urlUtil.appendQueryToUrl(url, "$" + DataLinkBuiltInVars.includeVars);
    }
    if (link.params) {
        url = urlUtil.appendQueryToUrl(url, link.params);
    }
    return {
        url: url,
        title: link.title,
        targetBlank: link.targetBlank,
    };
}
function updateVariablesSyntax(text) {
    var legacyVariableNamesRegex = /(__series_name)|(\$__series_name)|(__value_time)|(__field_name)|(\$__field_name)/g;
    return text.replace(legacyVariableNamesRegex, function (match, seriesName, seriesName1, valueTime, fieldName, fieldName1) {
        if (seriesName) {
            return '__series.name';
        }
        if (seriesName1) {
            return '${__series.name}';
        }
        if (valueTime) {
            return '__value.time';
        }
        if (fieldName) {
            return '__field.name';
        }
        if (fieldName1) {
            return '${__field.name}';
        }
        return match;
    });
}
function migrateSinglestat(panel) {
    var _a;
    // If   'grafana-singlestat-panel' exists, move to that
    if (config.panels['grafana-singlestat-panel']) {
        panel.type = 'grafana-singlestat-panel';
        return panel;
    }
    var returnSaveModel = false;
    if (!panel.changePlugin) {
        returnSaveModel = true;
        panel = new PanelModel(panel);
    }
    // To make sure PanelModel.isAngularPlugin logic thinks the current panel is angular
    // And since this plugin no longer exist we just fake it here
    panel.plugin = { angularPanelCtrl: {} };
    // Otheriwse use gauge or stat panel
    if ((_a = panel.gauge) === null || _a === void 0 ? void 0 : _a.show) {
        gaugePanelPlugin.meta = config.panels['gauge'];
        panel.changePlugin(gaugePanelPlugin);
    }
    else {
        statPanelPlugin.meta = config.panels['stat'];
        panel.changePlugin(statPanelPlugin);
    }
    if (returnSaveModel) {
        return panel.getSaveModel();
    }
    return panel;
}
export function migrateDatasourceNameToRef(name) {
    if (!name || name === 'default') {
        return null;
    }
    var ds = getDataSourceSrv().getInstanceSettings(name);
    if (!ds) {
        return { uid: name }; // not found
    }
    return { type: ds.meta.id, uid: ds.uid };
}
// mutates transformations appending a new transformer after the existing one
function appendTransformerAfter(panel, id, cfg) {
    var e_16, _a;
    if (panel.transformations) {
        var transformations = [];
        try {
            for (var _b = __values(panel.transformations), _c = _b.next(); !_c.done; _c = _b.next()) {
                var t = _c.value;
                transformations.push(t);
                if (t.id === id) {
                    transformations.push(__assign({}, cfg));
                }
            }
        }
        catch (e_16_1) { e_16 = { error: e_16_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_16) throw e_16.error; }
        }
        panel.transformations = transformations;
    }
    return panel;
}
function upgradeValueMappingsForPanel(panel) {
    var e_17, _a, e_18, _b;
    var fieldConfig = panel.fieldConfig;
    if (!fieldConfig) {
        return panel;
    }
    if (fieldConfig.defaults) {
        fieldConfig.defaults.mappings = upgradeValueMappings(fieldConfig.defaults.mappings, fieldConfig.defaults.thresholds);
    }
    // Protect against no overrides
    if (Array.isArray(fieldConfig.overrides)) {
        try {
            for (var _c = __values(fieldConfig.overrides), _d = _c.next(); !_d.done; _d = _c.next()) {
                var override = _d.value;
                try {
                    for (var _e = (e_18 = void 0, __values(override.properties)), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var prop = _f.value;
                        if (prop.id === 'mappings') {
                            prop.value = upgradeValueMappings(prop.value);
                        }
                    }
                }
                catch (e_18_1) { e_18 = { error: e_18_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_18) throw e_18.error; }
                }
            }
        }
        catch (e_17_1) { e_17 = { error: e_17_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_17) throw e_17.error; }
        }
    }
    return panel;
}
function isLegacyCloudWatchQuery(target) {
    return (target.hasOwnProperty('dimensions') &&
        target.hasOwnProperty('namespace') &&
        target.hasOwnProperty('region') &&
        target.hasOwnProperty('statistics'));
}
function isLegacyCloudWatchAnnotationQuery(target) {
    return (target.hasOwnProperty('dimensions') &&
        target.hasOwnProperty('namespace') &&
        target.hasOwnProperty('region') &&
        target.hasOwnProperty('prefixMatching') &&
        target.hasOwnProperty('statistics'));
}
function upgradeValueMappings(oldMappings, thresholds) {
    var e_19, _a;
    if (!oldMappings) {
        return undefined;
    }
    var valueMaps = { type: MappingType.ValueToText, options: {} };
    var newMappings = [];
    try {
        for (var oldMappings_1 = __values(oldMappings), oldMappings_1_1 = oldMappings_1.next(); !oldMappings_1_1.done; oldMappings_1_1 = oldMappings_1.next()) {
            var old = oldMappings_1_1.value;
            // when migrating singlestat to stat/gauge, mappings are handled by panel type change handler used in that migration
            if (old.type && old.options) {
                // collect al value->text mappings in a single value map object. These are migrated by panel change handler as a separate value maps
                if (old.type === MappingType.ValueToText) {
                    valueMaps.options = __assign(__assign({}, valueMaps.options), old.options);
                }
                else {
                    newMappings.push(old);
                }
                continue;
            }
            // Use the color we would have picked from thesholds
            var color = undefined;
            var numeric = parseFloat(old.text);
            if (thresholds && !isNaN(numeric)) {
                var level = getActiveThreshold(numeric, thresholds.steps);
                if (level && level.color) {
                    color = level.color;
                }
            }
            switch (old.type) {
                case 1: // MappingType.ValueToText:
                    if (old.value != null) {
                        if (old.value === 'null') {
                            newMappings.push({
                                type: MappingType.SpecialValue,
                                options: {
                                    match: SpecialValueMatch.Null,
                                    result: { text: old.text, color: color },
                                },
                            });
                        }
                        else {
                            valueMaps.options[String(old.value)] = {
                                text: old.text,
                                color: color,
                            };
                        }
                    }
                    break;
                case 2: // MappingType.RangeToText:
                    newMappings.push({
                        type: MappingType.RangeToText,
                        options: {
                            from: +old.from,
                            to: +old.to,
                            result: { text: old.text, color: color },
                        },
                    });
                    break;
            }
        }
    }
    catch (e_19_1) { e_19 = { error: e_19_1 }; }
    finally {
        try {
            if (oldMappings_1_1 && !oldMappings_1_1.done && (_a = oldMappings_1.return)) _a.call(oldMappings_1);
        }
        finally { if (e_19) throw e_19.error; }
    }
    if (Object.keys(valueMaps.options).length > 0) {
        newMappings.unshift(valueMaps);
    }
    return newMappings;
}
function migrateTooltipOptions(panel) {
    if (panel.type === 'timeseries' || panel.type === 'xychart') {
        if (panel.options.tooltipOptions) {
            panel.options = __assign(__assign({}, panel.options), { tooltip: panel.options.tooltipOptions });
            delete panel.options.tooltipOptions;
        }
    }
    return panel;
}
//# sourceMappingURL=DashboardMigrator.js.map