import * as tslib_1 from "tslib";
import _ from 'lodash';
import { GRID_COLUMN_COUNT, GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, DEFAULT_ROW_HEIGHT, MIN_PANEL_HEIGHT, DEFAULT_PANEL_SPAN, } from 'app/core/constants';
import { PanelModel } from './PanelModel';
import getFactors from 'app/core/utils/factors';
var DashboardMigrator = /** @class */ (function () {
    function DashboardMigrator(dashboardModel) {
        this.dashboard = dashboardModel;
    }
    DashboardMigrator.prototype.updateSchema = function (old) {
        var i, j, k, n;
        var oldVersion = this.dashboard.schemaVersion;
        var panelUpgrades = [];
        this.dashboard.schemaVersion = 18;
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
                    return;
                }
                if (_.isBoolean(panel.legend)) {
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
            });
        }
        // schema version 3 changes
        if (oldVersion < 3) {
            // ensure panel ids
            var maxId_1 = this.dashboard.getNextPanelId();
            panelUpgrades.push(function (panel) {
                if (!panel.id) {
                    panel.id = maxId_1;
                    maxId_1 += 1;
                }
            });
        }
        // schema version 4 changes
        if (oldVersion < 4) {
            // move aliasYAxis changes
            panelUpgrades.push(function (panel) {
                if (panel.type !== 'graph') {
                    return;
                }
                _.each(panel.aliasYAxis, function (value, key) {
                    panel.seriesOverrides = [{ alias: key, yaxis: value }];
                });
                delete panel.aliasYAxis;
            });
        }
        if (oldVersion < 6) {
            // move pulldowns to new schema
            var annotations = _.find(old.pulldowns, { type: 'annotations' });
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
                _.each(panel.targets, function (target) {
                    if (!target.refId) {
                        target.refId = panel.getNextQueryLetter && panel.getNextQueryLetter();
                    }
                });
            });
        }
        if (oldVersion < 8) {
            panelUpgrades.push(function (panel) {
                _.each(panel.targets, function (target) {
                    // update old influxdb query schema
                    if (target.fields && target.tags && target.groupBy) {
                        if (target.rawQuery) {
                            delete target.fields;
                            delete target.fill;
                        }
                        else {
                            target.select = _.map(target.fields, function (field) {
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
                            _.each(target.groupBy, function (part) {
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
            });
        }
        // schema version 9 changes
        if (oldVersion < 9) {
            // move aliasYAxis changes
            panelUpgrades.push(function (panel) {
                if (panel.type !== 'singlestat' && panel.thresholds !== '') {
                    return;
                }
                if (panel.thresholds) {
                    var k_1 = panel.thresholds.split(',');
                    if (k_1.length >= 3) {
                        k_1.shift();
                        panel.thresholds = k_1.join(',');
                    }
                }
            });
        }
        // schema version 10 changes
        if (oldVersion < 10) {
            // move aliasYAxis changes
            panelUpgrades.push(function (panel) {
                if (panel.type !== 'table') {
                    return;
                }
                _.each(panel.styles, function (style) {
                    if (style.thresholds && style.thresholds.length >= 3) {
                        var k_2 = style.thresholds;
                        k_2.shift();
                        style.thresholds = k_2;
                    }
                });
            });
        }
        if (oldVersion < 12) {
            // update template variables
            _.each(this.dashboard.templating.list, function (templateVariable) {
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
                    return;
                }
                if (!panel.grid) {
                    return;
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
            });
        }
        if (oldVersion < 13) {
            // update graph yaxes changes
            panelUpgrades.push(function (panel) {
                if (panel.type !== 'graph') {
                    return;
                }
                if (!panel.grid) {
                    return;
                }
                panel.thresholds = [];
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
                if (_.isNumber(t1.value)) {
                    if (_.isNumber(t2.value)) {
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
                        factors[_.findIndex(factors, function (o) {
                            return o > max_1;
                        }) - 1];
                }
                delete panel.minSpan;
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
            });
        }
        if (panelUpgrades.length === 0) {
            return;
        }
        for (j = 0; j < this.dashboard.panels.length; j++) {
            for (k = 0; k < panelUpgrades.length; k++) {
                panelUpgrades[k].call(this, this.dashboard.panels[j]);
                if (this.dashboard.panels[j].panels) {
                    for (n = 0; n < this.dashboard.panels[j].panels.length; n++) {
                        panelUpgrades[k].call(this, this.dashboard.panels[j].panels[n]);
                    }
                }
            }
        }
    };
    DashboardMigrator.prototype.upgradeToGridLayout = function (old) {
        var e_1, _a, e_2, _b;
        var yPos = 0;
        var widthFactor = GRID_COLUMN_COUNT / 12;
        var maxPanelId = _.max(_.flattenDeep(_.map(old.rows, function (row) {
            return _.map(row.panels, 'id');
        })));
        var nextRowId = maxPanelId + 1;
        if (!old.rows) {
            return;
        }
        // Add special "row" panels if even one row is collapsed, repeated or has visible title
        var showRows = _.some(old.rows, function (row) { return row.collapse || row.showTitle || row.repeat; });
        try {
            for (var _c = tslib_1.__values(old.rows), _d = _c.next(); !_d.done; _d = _c.next()) {
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
                    for (var _e = tslib_1.__values(row.panels), _f = _e.next(); !_f.done; _f = _e.next()) {
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
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                if (rowPanelModel) {
                    this.dashboard.panels.push(rowPanelModel);
                }
                if (!(rowPanelModel && rowPanel.collapsed)) {
                    yPos += rowGridHeight;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
    };
    return DashboardMigrator;
}());
export { DashboardMigrator };
function getGridHeight(height) {
    if (_.isString(height)) {
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
            var yPos = _.max(this.area.slice(startPlace));
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
//# sourceMappingURL=DashboardMigrator.js.map