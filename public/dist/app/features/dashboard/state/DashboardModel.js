import * as tslib_1 from "tslib";
// Libaries
import moment from 'moment';
import _ from 'lodash';
// Constants
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { GRID_COLUMN_COUNT, REPEAT_DIR_VERTICAL, GRID_CELL_HEIGHT, GRID_CELL_VMARGIN } from 'app/core/constants';
// Utils & Services
import { Emitter } from 'app/core/utils/emitter';
import { contextSrv } from 'app/core/services/context_srv';
import sortByKeys from 'app/core/utils/sort_by_keys';
// Types
import { PanelModel } from './PanelModel';
import { DashboardMigrator } from './DashboardMigrator';
import { KIOSK_MODE_TV } from 'app/types';
var DashboardModel = /** @class */ (function () {
    function DashboardModel(data, meta) {
        if (!data) {
            data = {};
        }
        this.events = new Emitter();
        this.id = data.id || null;
        this.uid = data.uid || null;
        this.revision = data.revision;
        this.title = data.title || 'No Title';
        this.autoUpdate = data.autoUpdate;
        this.description = data.description;
        this.tags = data.tags || [];
        this.style = data.style || 'dark';
        this.timezone = data.timezone || '';
        this.editable = data.editable !== false;
        this.graphTooltip = data.graphTooltip || 0;
        this.time = data.time || { from: 'now-6h', to: 'now' };
        this.timepicker = data.timepicker || {};
        this.templating = this.ensureListExist(data.templating);
        this.annotations = this.ensureListExist(data.annotations);
        this.refresh = data.refresh;
        this.snapshot = data.snapshot;
        this.schemaVersion = data.schemaVersion || 0;
        this.version = data.version || 0;
        this.links = data.links || [];
        this.gnetId = data.gnetId || null;
        this.panels = _.map(data.panels || [], function (panelData) { return new PanelModel(panelData); });
        this.colors = data.colors || [];
        this.resetOriginalVariables();
        this.resetOriginalTime();
        this.initMeta(meta);
        this.updateSchema(data);
        this.addBuiltInAnnotationQuery();
        this.sortPanelsByGridPos();
    }
    DashboardModel.prototype.addBuiltInAnnotationQuery = function () {
        var e_1, _a;
        var found = false;
        try {
            for (var _b = tslib_1.__values(this.annotations.list), _c = _b.next(); !_c.done; _c = _b.next()) {
                var item = _c.value;
                if (item.builtIn === 1) {
                    found = true;
                    break;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (found) {
            return;
        }
        this.annotations.list.unshift({
            datasource: '-- Grafana --',
            name: 'Annotations & Alerts',
            type: 'dashboard',
            iconColor: DEFAULT_ANNOTATION_COLOR,
            enable: true,
            hide: true,
            builtIn: 1,
        });
    };
    DashboardModel.prototype.initMeta = function (meta) {
        meta = meta || {};
        meta.canShare = meta.canShare !== false;
        meta.canSave = meta.canSave !== false;
        meta.canStar = meta.canStar !== false;
        meta.canEdit = meta.canEdit !== false;
        meta.showSettings = meta.canEdit;
        meta.canMakeEditable = meta.canSave && !this.editable;
        meta.fullscreen = false;
        meta.isEditing = false;
        if (!this.editable) {
            meta.canEdit = false;
            meta.canDelete = false;
            meta.canSave = false;
        }
        this.meta = meta;
    };
    // cleans meta data and other non persistent state
    DashboardModel.prototype.getSaveModelClone = function (options) {
        var defaults = _.defaults(options || {}, {
            saveVariables: true,
            saveTimerange: true,
        });
        // make clone
        var copy = {};
        for (var property in this) {
            if (DashboardModel.nonPersistedProperties[property] || !this.hasOwnProperty(property)) {
                continue;
            }
            copy[property] = _.cloneDeep(this[property]);
        }
        // get variable save models
        copy.templating = {
            list: _.map(this.templating.list, function (variable) { return (variable.getSaveModel ? variable.getSaveModel() : variable); }),
        };
        if (!defaults.saveVariables) {
            for (var i = 0; i < copy.templating.list.length; i++) {
                var current = copy.templating.list[i];
                var original = _.find(this.originalTemplating, { name: current.name, type: current.type });
                if (!original) {
                    continue;
                }
                if (current.type === 'adhoc') {
                    copy.templating.list[i].filters = original.filters;
                }
                else {
                    copy.templating.list[i].current = original.current;
                }
            }
        }
        if (!defaults.saveTimerange) {
            copy.time = this.originalTime;
        }
        // get panel save models
        copy.panels = _.chain(this.panels)
            .filter(function (panel) { return panel.type !== 'add-panel'; })
            .map(function (panel) { return panel.getSaveModel(); })
            .value();
        //  sort by keys
        copy = sortByKeys(copy);
        return copy;
    };
    DashboardModel.prototype.setViewMode = function (panel, fullscreen, isEditing) {
        this.meta.fullscreen = fullscreen;
        this.meta.isEditing = isEditing && this.meta.canEdit;
        panel.setViewMode(fullscreen, this.meta.isEditing);
        this.events.emit('view-mode-changed', panel);
    };
    DashboardModel.prototype.timeRangeUpdated = function (timeRange) {
        this.events.emit('time-range-updated', timeRange);
    };
    DashboardModel.prototype.startRefresh = function () {
        var e_2, _a;
        this.events.emit('refresh');
        try {
            for (var _b = tslib_1.__values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                if (!this.otherPanelInFullscreen(panel)) {
                    panel.refresh();
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
    };
    DashboardModel.prototype.render = function () {
        var e_3, _a;
        this.events.emit('render');
        try {
            for (var _b = tslib_1.__values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                panel.render();
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
    };
    DashboardModel.prototype.panelInitialized = function (panel) {
        panel.initialized();
        if (!this.otherPanelInFullscreen(panel)) {
            panel.refresh();
        }
    };
    DashboardModel.prototype.otherPanelInFullscreen = function (panel) {
        return this.meta.fullscreen && !panel.fullscreen;
    };
    DashboardModel.prototype.ensureListExist = function (data) {
        if (!data) {
            data = {};
        }
        if (!data.list) {
            data.list = [];
        }
        return data;
    };
    DashboardModel.prototype.getNextPanelId = function () {
        var e_4, _a, e_5, _b;
        var max = 0;
        try {
            for (var _c = tslib_1.__values(this.panels), _d = _c.next(); !_d.done; _d = _c.next()) {
                var panel = _d.value;
                if (panel.id > max) {
                    max = panel.id;
                }
                if (panel.collapsed) {
                    try {
                        for (var _e = tslib_1.__values(panel.panels), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var rowPanel = _f.value;
                            if (rowPanel.id > max) {
                                max = rowPanel.id;
                            }
                        }
                    }
                    catch (e_5_1) { e_5 = { error: e_5_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_5) throw e_5.error; }
                    }
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return max + 1;
    };
    DashboardModel.prototype.forEachPanel = function (callback) {
        for (var i = 0; i < this.panels.length; i++) {
            callback(this.panels[i], i);
        }
    };
    DashboardModel.prototype.getPanelById = function (id) {
        var e_6, _a;
        try {
            for (var _b = tslib_1.__values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                if (panel.id === id) {
                    return panel;
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
        return null;
    };
    DashboardModel.prototype.addPanel = function (panelData) {
        panelData.id = this.getNextPanelId();
        var panel = new PanelModel(panelData);
        this.panels.unshift(panel);
        this.sortPanelsByGridPos();
        this.events.emit('panel-added', panel);
    };
    DashboardModel.prototype.sortPanelsByGridPos = function () {
        this.panels.sort(function (panelA, panelB) {
            if (panelA.gridPos.y === panelB.gridPos.y) {
                return panelA.gridPos.x - panelB.gridPos.x;
            }
            else {
                return panelA.gridPos.y - panelB.gridPos.y;
            }
        });
    };
    DashboardModel.prototype.cleanUpRepeats = function () {
        var e_7, _a;
        if (this.snapshot || this.templating.list.length === 0) {
            return;
        }
        this.iteration = (this.iteration || new Date().getTime()) + 1;
        var panelsToRemove = [];
        try {
            // cleanup scopedVars
            for (var _b = tslib_1.__values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                delete panel.scopedVars;
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_7) throw e_7.error; }
        }
        for (var i = 0; i < this.panels.length; i++) {
            var panel = this.panels[i];
            if ((!panel.repeat || panel.repeatedByRow) && panel.repeatPanelId && panel.repeatIteration !== this.iteration) {
                panelsToRemove.push(panel);
            }
        }
        // remove panels
        _.pull.apply(_, tslib_1.__spread([this.panels], panelsToRemove));
        this.sortPanelsByGridPos();
        this.events.emit('repeats-processed');
    };
    DashboardModel.prototype.processRepeats = function () {
        if (this.snapshot || this.templating.list.length === 0) {
            return;
        }
        this.cleanUpRepeats();
        this.iteration = (this.iteration || new Date().getTime()) + 1;
        for (var i = 0; i < this.panels.length; i++) {
            var panel = this.panels[i];
            if (panel.repeat) {
                this.repeatPanel(panel, i);
            }
        }
        this.sortPanelsByGridPos();
        this.events.emit('repeats-processed');
    };
    DashboardModel.prototype.cleanUpRowRepeats = function (rowPanels) {
        var panelsToRemove = [];
        for (var i = 0; i < rowPanels.length; i++) {
            var panel = rowPanels[i];
            if (!panel.repeat && panel.repeatPanelId) {
                panelsToRemove.push(panel);
            }
        }
        _.pull.apply(_, tslib_1.__spread([rowPanels], panelsToRemove));
        _.pull.apply(_, tslib_1.__spread([this.panels], panelsToRemove));
    };
    DashboardModel.prototype.processRowRepeats = function (row) {
        if (this.snapshot || this.templating.list.length === 0) {
            return;
        }
        var rowPanels = row.panels;
        if (!row.collapsed) {
            var rowPanelIndex = _.findIndex(this.panels, function (p) { return p.id === row.id; });
            rowPanels = this.getRowPanels(rowPanelIndex);
        }
        this.cleanUpRowRepeats(rowPanels);
        var _loop_1 = function (i) {
            var panel = rowPanels[i];
            if (panel.repeat) {
                var panelIndex = _.findIndex(this_1.panels, function (p) { return p.id === panel.id; });
                this_1.repeatPanel(panel, panelIndex);
            }
        };
        var this_1 = this;
        for (var i = 0; i < rowPanels.length; i++) {
            _loop_1(i);
        }
    };
    DashboardModel.prototype.getPanelRepeatClone = function (sourcePanel, valueIndex, sourcePanelIndex) {
        // if first clone return source
        if (valueIndex === 0) {
            return sourcePanel;
        }
        var clone = new PanelModel(sourcePanel.getSaveModel());
        clone.id = this.getNextPanelId();
        // insert after source panel + value index
        this.panels.splice(sourcePanelIndex + valueIndex, 0, clone);
        clone.repeatIteration = this.iteration;
        clone.repeatPanelId = sourcePanel.id;
        clone.repeat = null;
        return clone;
    };
    DashboardModel.prototype.getRowRepeatClone = function (sourceRowPanel, valueIndex, sourcePanelIndex) {
        // if first clone return source
        if (valueIndex === 0) {
            if (!sourceRowPanel.collapsed) {
                var rowPanels_1 = this.getRowPanels(sourcePanelIndex);
                sourceRowPanel.panels = rowPanels_1;
            }
            return sourceRowPanel;
        }
        var clone = new PanelModel(sourceRowPanel.getSaveModel());
        // for row clones we need to figure out panels under row to clone and where to insert clone
        var rowPanels, insertPos;
        if (sourceRowPanel.collapsed) {
            rowPanels = _.cloneDeep(sourceRowPanel.panels);
            clone.panels = rowPanels;
            // insert copied row after preceding row
            insertPos = sourcePanelIndex + valueIndex;
        }
        else {
            rowPanels = this.getRowPanels(sourcePanelIndex);
            clone.panels = _.map(rowPanels, function (panel) { return panel.getSaveModel(); });
            // insert copied row after preceding row's panels
            insertPos = sourcePanelIndex + (rowPanels.length + 1) * valueIndex;
        }
        this.panels.splice(insertPos, 0, clone);
        this.updateRepeatedPanelIds(clone);
        return clone;
    };
    DashboardModel.prototype.repeatPanel = function (panel, panelIndex) {
        var variable = _.find(this.templating.list, { name: panel.repeat });
        if (!variable) {
            return;
        }
        if (panel.type === 'row') {
            this.repeatRow(panel, panelIndex, variable);
            return;
        }
        var selectedOptions = this.getSelectedVariableOptions(variable);
        var maxPerRow = panel.maxPerRow || 4;
        var xPos = 0;
        var yPos = panel.gridPos.y;
        for (var index = 0; index < selectedOptions.length; index++) {
            var option = selectedOptions[index];
            var copy = void 0;
            copy = this.getPanelRepeatClone(panel, index, panelIndex);
            copy.scopedVars = copy.scopedVars || {};
            copy.scopedVars[variable.name] = option;
            if (panel.repeatDirection === REPEAT_DIR_VERTICAL) {
                if (index > 0) {
                    yPos += copy.gridPos.h;
                }
                copy.gridPos.y = yPos;
            }
            else {
                // set width based on how many are selected
                // assumed the repeated panels should take up full row width
                copy.gridPos.w = Math.max(GRID_COLUMN_COUNT / selectedOptions.length, GRID_COLUMN_COUNT / maxPerRow);
                copy.gridPos.x = xPos;
                copy.gridPos.y = yPos;
                xPos += copy.gridPos.w;
                // handle overflow by pushing down one row
                if (xPos + copy.gridPos.w > GRID_COLUMN_COUNT) {
                    xPos = 0;
                    yPos += copy.gridPos.h;
                }
            }
        }
        // Update gridPos for panels below
        var yOffset = yPos - panel.gridPos.y;
        if (yOffset > 0) {
            var panelBelowIndex = panelIndex + selectedOptions.length;
            for (var i = panelBelowIndex; i < this.panels.length; i++) {
                this.panels[i].gridPos.y += yOffset;
            }
        }
    };
    DashboardModel.prototype.repeatRow = function (panel, panelIndex, variable) {
        var _this = this;
        var selectedOptions = this.getSelectedVariableOptions(variable);
        var yPos = panel.gridPos.y;
        function setScopedVars(panel, variableOption) {
            panel.scopedVars = panel.scopedVars || {};
            panel.scopedVars[variable.name] = variableOption;
        }
        var _loop_2 = function (optionIndex) {
            var option = selectedOptions[optionIndex];
            var rowCopy = this_2.getRowRepeatClone(panel, optionIndex, panelIndex);
            setScopedVars(rowCopy, option);
            var rowHeight = this_2.getRowHeight(rowCopy);
            var rowPanels = rowCopy.panels || [];
            var panelBelowIndex = void 0;
            if (panel.collapsed) {
                // For collapsed row just copy its panels and set scoped vars and proper IDs
                _.each(rowPanels, function (rowPanel, i) {
                    setScopedVars(rowPanel, option);
                    if (optionIndex > 0) {
                        _this.updateRepeatedPanelIds(rowPanel, true);
                    }
                });
                rowCopy.gridPos.y += optionIndex;
                yPos += optionIndex;
                panelBelowIndex = panelIndex + optionIndex + 1;
            }
            else {
                // insert after 'row' panel
                var insertPos_1 = panelIndex + (rowPanels.length + 1) * optionIndex + 1;
                _.each(rowPanels, function (rowPanel, i) {
                    setScopedVars(rowPanel, option);
                    if (optionIndex > 0) {
                        var cloneRowPanel = new PanelModel(rowPanel);
                        _this.updateRepeatedPanelIds(cloneRowPanel, true);
                        // For exposed row additionally set proper Y grid position and add it to dashboard panels
                        cloneRowPanel.gridPos.y += rowHeight * optionIndex;
                        _this.panels.splice(insertPos_1 + i, 0, cloneRowPanel);
                    }
                });
                rowCopy.panels = [];
                rowCopy.gridPos.y += rowHeight * optionIndex;
                yPos += rowHeight;
                panelBelowIndex = insertPos_1 + rowPanels.length;
            }
            // Update gridPos for panels below
            for (var i = panelBelowIndex; i < this_2.panels.length; i++) {
                this_2.panels[i].gridPos.y += yPos;
            }
        };
        var this_2 = this;
        for (var optionIndex = 0; optionIndex < selectedOptions.length; optionIndex++) {
            _loop_2(optionIndex);
        }
    };
    DashboardModel.prototype.updateRepeatedPanelIds = function (panel, repeatedByRow) {
        panel.repeatPanelId = panel.id;
        panel.id = this.getNextPanelId();
        panel.repeatIteration = this.iteration;
        if (repeatedByRow) {
            panel.repeatedByRow = true;
        }
        else {
            panel.repeat = null;
        }
        return panel;
    };
    DashboardModel.prototype.getSelectedVariableOptions = function (variable) {
        var selectedOptions;
        if (variable.current.text === 'All') {
            selectedOptions = variable.options.slice(1, variable.options.length);
        }
        else {
            selectedOptions = _.filter(variable.options, { selected: true });
        }
        return selectedOptions;
    };
    DashboardModel.prototype.getRowHeight = function (rowPanel) {
        if (!rowPanel.panels || rowPanel.panels.length === 0) {
            return 0;
        }
        var rowYPos = rowPanel.gridPos.y;
        var positions = _.map(rowPanel.panels, 'gridPos');
        var maxPos = _.maxBy(positions, function (pos) {
            return pos.y + pos.h;
        });
        return maxPos.y + maxPos.h - rowYPos;
    };
    DashboardModel.prototype.removePanel = function (panel) {
        var index = _.indexOf(this.panels, panel);
        this.panels.splice(index, 1);
        this.events.emit('panel-removed', panel);
    };
    DashboardModel.prototype.removeRow = function (row, removePanels) {
        var needToogle = (!removePanels && row.collapsed) || (removePanels && !row.collapsed);
        if (needToogle) {
            this.toggleRow(row);
        }
        this.removePanel(row);
    };
    DashboardModel.prototype.expandRows = function () {
        for (var i = 0; i < this.panels.length; i++) {
            var panel = this.panels[i];
            if (panel.type !== 'row') {
                continue;
            }
            if (panel.collapsed) {
                this.toggleRow(panel);
            }
        }
    };
    DashboardModel.prototype.collapseRows = function () {
        for (var i = 0; i < this.panels.length; i++) {
            var panel = this.panels[i];
            if (panel.type !== 'row') {
                continue;
            }
            if (!panel.collapsed) {
                this.toggleRow(panel);
            }
        }
    };
    DashboardModel.prototype.setPanelFocus = function (id) {
        this.meta.focusPanelId = id;
    };
    DashboardModel.prototype.updateSubmenuVisibility = function () {
        var _this = this;
        this.meta.submenuEnabled = (function () {
            if (_this.links.length > 0) {
                return true;
            }
            var visibleVars = _.filter(_this.templating.list, function (variable) { return variable.hide !== 2; });
            if (visibleVars.length > 0) {
                return true;
            }
            var visibleAnnotations = _.filter(_this.annotations.list, function (annotation) { return annotation.hide !== true; });
            if (visibleAnnotations.length > 0) {
                return true;
            }
            return false;
        })();
    };
    DashboardModel.prototype.getPanelInfoById = function (panelId) {
        for (var i = 0; i < this.panels.length; i++) {
            if (this.panels[i].id === panelId) {
                return {
                    panel: this.panels[i],
                    index: i,
                };
            }
        }
        return null;
    };
    DashboardModel.prototype.duplicatePanel = function (panel) {
        var newPanel = panel.getSaveModel();
        newPanel.id = this.getNextPanelId();
        delete newPanel.repeat;
        delete newPanel.repeatIteration;
        delete newPanel.repeatPanelId;
        delete newPanel.scopedVars;
        if (newPanel.alert) {
            delete newPanel.thresholds;
        }
        delete newPanel.alert;
        // does it fit to the right?
        if (panel.gridPos.x + panel.gridPos.w * 2 <= GRID_COLUMN_COUNT) {
            newPanel.gridPos.x += panel.gridPos.w;
        }
        else {
            // add below
            newPanel.gridPos.y += panel.gridPos.h;
        }
        this.addPanel(newPanel);
        return newPanel;
    };
    DashboardModel.prototype.formatDate = function (date, format) {
        date = moment.isMoment(date) ? date : moment(date);
        format = format || 'YYYY-MM-DD HH:mm:ss';
        var timezone = this.getTimezone();
        return timezone === 'browser' ? moment(date).format(format) : moment.utc(date).format(format);
    };
    DashboardModel.prototype.destroy = function () {
        var e_8, _a;
        this.events.removeAllListeners();
        try {
            for (var _b = tslib_1.__values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                panel.destroy();
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_8) throw e_8.error; }
        }
    };
    DashboardModel.prototype.toggleRow = function (row) {
        var e_9, _a;
        var rowIndex = _.indexOf(this.panels, row);
        if (row.collapsed) {
            row.collapsed = false;
            var hasRepeat = _.some(row.panels, function (p) { return p.repeat; });
            if (row.panels.length > 0) {
                // Use first panel to figure out if it was moved or pushed
                var firstPanel = row.panels[0];
                var yDiff = firstPanel.gridPos.y - (row.gridPos.y + row.gridPos.h);
                // start inserting after row
                var insertPos = rowIndex + 1;
                // y max will represent the bottom y pos after all panels have been added
                // needed to know home much panels below should be pushed down
                var yMax = row.gridPos.y;
                try {
                    for (var _b = tslib_1.__values(row.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var panel = _c.value;
                        // make sure y is adjusted (in case row moved while collapsed)
                        // console.log('yDiff', yDiff);
                        panel.gridPos.y -= yDiff;
                        // insert after row
                        this.panels.splice(insertPos, 0, new PanelModel(panel));
                        // update insert post and y max
                        insertPos += 1;
                        yMax = Math.max(yMax, panel.gridPos.y + panel.gridPos.h);
                    }
                }
                catch (e_9_1) { e_9 = { error: e_9_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_9) throw e_9.error; }
                }
                var pushDownAmount = yMax - row.gridPos.y - 1;
                // push panels below down
                for (var panelIndex = insertPos; panelIndex < this.panels.length; panelIndex++) {
                    this.panels[panelIndex].gridPos.y += pushDownAmount;
                }
                row.panels = [];
                if (hasRepeat) {
                    this.processRowRepeats(row);
                }
            }
            // sort panels
            this.sortPanelsByGridPos();
            // emit change event
            this.events.emit('row-expanded');
            return;
        }
        var rowPanels = this.getRowPanels(rowIndex);
        // remove panels
        _.pull.apply(_, tslib_1.__spread([this.panels], rowPanels));
        // save panel models inside row panel
        row.panels = _.map(rowPanels, function (panel) { return panel.getSaveModel(); });
        row.collapsed = true;
        // emit change event
        this.events.emit('row-collapsed');
    };
    /**
     * Will return all panels after rowIndex until it encounters another row
     */
    DashboardModel.prototype.getRowPanels = function (rowIndex) {
        var rowPanels = [];
        for (var index = rowIndex + 1; index < this.panels.length; index++) {
            var panel = this.panels[index];
            // break when encountering another row
            if (panel.type === 'row') {
                break;
            }
            // this panel must belong to row
            rowPanels.push(panel);
        }
        return rowPanels;
    };
    DashboardModel.prototype.on = function (eventName, callback) {
        this.events.on(eventName, callback);
    };
    DashboardModel.prototype.off = function (eventName, callback) {
        this.events.off(eventName, callback);
    };
    DashboardModel.prototype.cycleGraphTooltip = function () {
        this.graphTooltip = (this.graphTooltip + 1) % 3;
    };
    DashboardModel.prototype.sharedTooltipModeEnabled = function () {
        return this.graphTooltip > 0;
    };
    DashboardModel.prototype.sharedCrosshairModeOnly = function () {
        return this.graphTooltip === 1;
    };
    DashboardModel.prototype.getRelativeTime = function (date) {
        date = moment.isMoment(date) ? date : moment(date);
        return this.timezone === 'browser' ? moment(date).fromNow() : moment.utc(date).fromNow();
    };
    DashboardModel.prototype.isTimezoneUtc = function () {
        return this.getTimezone() === 'utc';
    };
    DashboardModel.prototype.isSnapshot = function () {
        return this.snapshot !== undefined;
    };
    DashboardModel.prototype.getTimezone = function () {
        return this.timezone ? this.timezone : contextSrv.user.timezone;
    };
    DashboardModel.prototype.updateSchema = function (old) {
        var migrator = new DashboardMigrator(this);
        migrator.updateSchema(old);
    };
    DashboardModel.prototype.resetOriginalTime = function () {
        this.originalTime = _.cloneDeep(this.time);
    };
    DashboardModel.prototype.hasTimeChanged = function () {
        return !_.isEqual(this.time, this.originalTime);
    };
    DashboardModel.prototype.resetOriginalVariables = function () {
        this.originalTemplating = _.map(this.templating.list, function (variable) {
            return {
                name: variable.name,
                type: variable.type,
                current: _.cloneDeep(variable.current),
                filters: _.cloneDeep(variable.filters),
            };
        });
    };
    DashboardModel.prototype.hasVariableValuesChanged = function () {
        if (this.templating.list.length !== this.originalTemplating.length) {
            return false;
        }
        var updated = _.map(this.templating.list, function (variable) {
            return {
                name: variable.name,
                type: variable.type,
                current: _.cloneDeep(variable.current),
                filters: _.cloneDeep(variable.filters),
            };
        });
        return !_.isEqual(updated, this.originalTemplating);
    };
    DashboardModel.prototype.autoFitPanels = function (viewHeight, kioskMode) {
        var currentGridHeight = Math.max.apply(Math, tslib_1.__spread(this.panels.map(function (panel) {
            return panel.gridPos.h + panel.gridPos.y;
        })));
        var navbarHeight = 55;
        var margin = 20;
        var submenuHeight = 50;
        var visibleHeight = viewHeight - navbarHeight - margin;
        // Remove submenu height if visible
        if (this.meta.submenuEnabled && !kioskMode) {
            visibleHeight -= submenuHeight;
        }
        // add back navbar height
        if (kioskMode && kioskMode !== KIOSK_MODE_TV) {
            visibleHeight += navbarHeight;
        }
        var visibleGridHeight = Math.floor(visibleHeight / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN));
        var scaleFactor = currentGridHeight / visibleGridHeight;
        this.panels.forEach(function (panel, i) {
            panel.gridPos.y = Math.round(panel.gridPos.y / scaleFactor) || 1;
            panel.gridPos.h = Math.round(panel.gridPos.h / scaleFactor) || 1;
        });
    };
    DashboardModel.prototype.templateVariableValueUpdated = function () {
        this.processRepeats();
        this.events.emit('template-variable-value-updated');
    };
    DashboardModel.prototype.expandParentRowFor = function (panelId) {
        var e_10, _a, e_11, _b;
        try {
            for (var _c = tslib_1.__values(this.panels), _d = _c.next(); !_d.done; _d = _c.next()) {
                var panel = _d.value;
                if (panel.collapsed) {
                    try {
                        for (var _e = tslib_1.__values(panel.panels), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var rowPanel = _f.value;
                            if (rowPanel.id === panelId) {
                                this.toggleRow(panel);
                                return;
                            }
                        }
                    }
                    catch (e_11_1) { e_11 = { error: e_11_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
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
    DashboardModel.prototype.toggleLegendsForAll = function () {
        var e_12, _a;
        var panelsWithLegends = this.panels.filter(function (panel) {
            return panel.legend !== undefined && panel.legend !== null;
        });
        // determine if more panels are displaying legends or not
        var onCount = panelsWithLegends.filter(function (panel) { return panel.legend.show; }).length;
        var offCount = panelsWithLegends.length - onCount;
        var panelLegendsOn = onCount >= offCount;
        try {
            for (var panelsWithLegends_1 = tslib_1.__values(panelsWithLegends), panelsWithLegends_1_1 = panelsWithLegends_1.next(); !panelsWithLegends_1_1.done; panelsWithLegends_1_1 = panelsWithLegends_1.next()) {
                var panel = panelsWithLegends_1_1.value;
                panel.legend.show = !panelLegendsOn;
                panel.render();
            }
        }
        catch (e_12_1) { e_12 = { error: e_12_1 }; }
        finally {
            try {
                if (panelsWithLegends_1_1 && !panelsWithLegends_1_1.done && (_a = panelsWithLegends_1.return)) _a.call(panelsWithLegends_1);
            }
            finally { if (e_12) throw e_12.error; }
        }
    };
    DashboardModel.nonPersistedProperties = {
        events: true,
        meta: true,
        panels: true,
        templating: true,
        originalTime: true,
        originalTemplating: true,
    };
    return DashboardModel;
}());
export { DashboardModel };
//# sourceMappingURL=DashboardModel.js.map