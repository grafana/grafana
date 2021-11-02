import { __read, __spreadArray, __values } from "tslib";
// Libaries
import { cloneDeep, defaults as _defaults, each, filter, find, findIndex, indexOf, isEqual, map, maxBy, pull, some, } from 'lodash';
// Constants
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT, REPEAT_DIR_VERTICAL } from 'app/core/constants';
// Utils & Services
import { contextSrv } from 'app/core/services/context_srv';
import sortByKeys from 'app/core/utils/sort_by_keys';
// Types
import { PanelModel } from './PanelModel';
import { DashboardMigrator } from './DashboardMigrator';
import { dateTimeFormat, dateTimeFormatTimeAgo, EventBusSrv, } from '@grafana/data';
import { CoreEvents, KioskMode } from 'app/types';
import { getVariables } from 'app/features/variables/state/selectors';
import { variableAdapters } from 'app/features/variables/adapters';
import { onTimeRangeUpdated } from 'app/features/variables/state/actions';
import { dispatch } from '../../../store/store';
import { isAllVariable } from '../../variables/utils';
import { DashboardPanelsChangedEvent, RenderEvent } from 'app/types/events';
import { getTimeSrv } from '../services/TimeSrv';
import { mergePanels } from '../utils/panelMerge';
import { isOnTheSameGridRow } from './utils';
import { RefreshEvent, TimeRangeUpdatedEvent } from '@grafana/runtime';
var DashboardModel = /** @class */ (function () {
    function DashboardModel(data, meta, getVariablesFromState) {
        var _this = this;
        if (getVariablesFromState === void 0) { getVariablesFromState = getVariables; }
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        this.getVariablesFromState = getVariablesFromState;
        this.getVariables = function () {
            return _this.getVariablesFromState();
        };
        if (!data) {
            data = {};
        }
        this.events = new EventBusSrv();
        this.id = data.id || null;
        this.uid = data.uid || null;
        this.revision = data.revision;
        this.title = (_a = data.title) !== null && _a !== void 0 ? _a : 'No Title';
        this.autoUpdate = data.autoUpdate;
        this.description = data.description;
        this.tags = (_b = data.tags) !== null && _b !== void 0 ? _b : [];
        this.style = (_c = data.style) !== null && _c !== void 0 ? _c : 'dark';
        this.timezone = (_d = data.timezone) !== null && _d !== void 0 ? _d : '';
        this.weekStart = (_e = data.weekStart) !== null && _e !== void 0 ? _e : '';
        this.editable = data.editable !== false;
        this.graphTooltip = data.graphTooltip || 0;
        this.time = (_f = data.time) !== null && _f !== void 0 ? _f : { from: 'now-6h', to: 'now' };
        this.timepicker = (_g = data.timepicker) !== null && _g !== void 0 ? _g : {};
        this.liveNow = Boolean(data.liveNow);
        this.templating = this.ensureListExist(data.templating);
        this.annotations = this.ensureListExist(data.annotations);
        this.refresh = data.refresh;
        this.snapshot = data.snapshot;
        this.schemaVersion = (_h = data.schemaVersion) !== null && _h !== void 0 ? _h : 0;
        this.fiscalYearStartMonth = (_j = data.fiscalYearStartMonth) !== null && _j !== void 0 ? _j : 0;
        this.version = (_k = data.version) !== null && _k !== void 0 ? _k : 0;
        this.links = (_l = data.links) !== null && _l !== void 0 ? _l : [];
        this.gnetId = data.gnetId || null;
        this.panels = map((_m = data.panels) !== null && _m !== void 0 ? _m : [], function (panelData) { return new PanelModel(panelData); });
        this.formatDate = this.formatDate.bind(this);
        this.resetOriginalVariables(true);
        this.resetOriginalTime();
        this.initMeta(meta);
        this.updateSchema(data);
        this.addBuiltInAnnotationQuery();
        this.sortPanelsByGridPos();
        this.hasChangesThatAffectsAllPanels = false;
    }
    DashboardModel.prototype.addBuiltInAnnotationQuery = function () {
        var e_1, _a;
        var found = false;
        try {
            for (var _b = __values(this.annotations.list), _c = _b.next(); !_c.done; _c = _b.next()) {
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
        meta.hasUnsavedFolderChange = false;
        if (!this.editable) {
            meta.canEdit = false;
            meta.canDelete = false;
            meta.canSave = false;
        }
        this.meta = meta;
    };
    // cleans meta data and other non persistent state
    DashboardModel.prototype.getSaveModelClone = function (options) {
        var defaults = _defaults(options || {}, {
            saveVariables: true,
            saveTimerange: true,
        });
        // make clone
        var copy = {};
        for (var property in this) {
            if (DashboardModel.nonPersistedProperties[property] || !this.hasOwnProperty(property)) {
                continue;
            }
            copy[property] = cloneDeep(this[property]);
        }
        this.updateTemplatingSaveModelClone(copy, defaults);
        if (!defaults.saveTimerange) {
            copy.time = this.originalTime;
        }
        // get panel save models
        copy.panels = this.getPanelSaveModels();
        //  sort by keys
        copy = sortByKeys(copy);
        copy.getVariables = function () {
            return copy.templating.list;
        };
        return copy;
    };
    /**
     * This will load a new dashboard, but keep existing panels unchanged
     *
     * This function can be used to implement:
     * 1. potentially faster loading dashboard loading
     * 2. dynamic dashboard behavior
     * 3. "live" dashboard editing
     *
     * @internal and experimental
     */
    DashboardModel.prototype.updatePanels = function (panels) {
        var _a;
        var info = mergePanels(this.panels, panels !== null && panels !== void 0 ? panels : []);
        if (info.changed) {
            this.panels = (_a = info.panels) !== null && _a !== void 0 ? _a : [];
            this.sortPanelsByGridPos();
            this.events.publish(new DashboardPanelsChangedEvent());
        }
        return info;
    };
    DashboardModel.prototype.getPanelSaveModels = function () {
        var _this = this;
        return this.panels
            .filter(function (panel) {
            if (_this.isSnapshotTruthy()) {
                return true;
            }
            if (panel.type === 'add-panel') {
                return false;
            }
            // skip repeated panels in the saved model
            if (panel.repeatPanelId) {
                return false;
            }
            // skip repeated rows in the saved model
            if (panel.repeatedByRow) {
                return false;
            }
            return true;
        })
            .map(function (panel) {
            // If we save while editing we should include the panel in edit mode instead of the
            // unmodified source panel
            if (_this.panelInEdit && _this.panelInEdit.id === panel.id) {
                return _this.panelInEdit.getSaveModel();
            }
            return panel.getSaveModel();
        })
            .map(function (model) {
            if (_this.isSnapshotTruthy()) {
                return model;
            }
            // Clear any scopedVars from persisted mode. This cannot be part of getSaveModel as we need to be able to copy
            // panel models with preserved scopedVars, for example when going into edit mode.
            delete model.scopedVars;
            // Clear any repeated panels from collapsed rows
            if (model.type === 'row' && model.panels && model.panels.length > 0) {
                model.panels = model.panels
                    .filter(function (rowPanel) { return !rowPanel.repeatPanelId; })
                    .map(function (model) {
                    delete model.scopedVars;
                    return model;
                });
            }
            return model;
        });
    };
    DashboardModel.prototype.updateTemplatingSaveModelClone = function (copy, defaults) {
        var originalVariables = this.originalTemplating;
        var currentVariables = this.getVariablesFromState();
        copy.templating = {
            list: currentVariables.map(function (variable) {
                return variableAdapters.get(variable.type).getSaveModel(variable, defaults.saveVariables);
            }),
        };
        if (!defaults.saveVariables) {
            for (var i = 0; i < copy.templating.list.length; i++) {
                var current = copy.templating.list[i];
                var original = find(originalVariables, { name: current.name, type: current.type });
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
    };
    DashboardModel.prototype.timeRangeUpdated = function (timeRange) {
        this.events.publish(new TimeRangeUpdatedEvent(timeRange));
        dispatch(onTimeRangeUpdated(timeRange));
    };
    DashboardModel.prototype.startRefresh = function () {
        var e_2, _a;
        this.events.publish(new RefreshEvent());
        if (this.panelInEdit) {
            this.panelInEdit.refresh();
            return;
        }
        try {
            for (var _b = __values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
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
        this.events.publish(new RenderEvent());
        try {
            for (var _b = __values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
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
        var lastResult = panel.getQueryRunner().getLastResult();
        if (!this.otherPanelInFullscreen(panel) && !lastResult) {
            panel.refresh();
        }
    };
    DashboardModel.prototype.otherPanelInFullscreen = function (panel) {
        return (this.panelInEdit || this.panelInView) && !(panel.isViewing || panel.isEditing);
    };
    DashboardModel.prototype.initEditPanel = function (sourcePanel) {
        getTimeSrv().pauseAutoRefresh();
        this.panelInEdit = sourcePanel.getEditClone();
        return this.panelInEdit;
    };
    DashboardModel.prototype.initViewPanel = function (panel) {
        this.panelInView = panel;
        panel.setIsViewing(true);
    };
    DashboardModel.prototype.exitViewPanel = function (panel) {
        this.panelInView = undefined;
        panel.setIsViewing(false);
        this.refreshIfChangeAffectsAllPanels();
    };
    DashboardModel.prototype.exitPanelEditor = function () {
        this.panelInEdit.destroy();
        this.panelInEdit = undefined;
        this.refreshIfChangeAffectsAllPanels();
        getTimeSrv().resumeAutoRefresh();
    };
    DashboardModel.prototype.setChangeAffectsAllPanels = function () {
        if (this.panelInEdit || this.panelInView) {
            this.hasChangesThatAffectsAllPanels = true;
        }
    };
    DashboardModel.prototype.refreshIfChangeAffectsAllPanels = function () {
        if (!this.hasChangesThatAffectsAllPanels) {
            return;
        }
        this.hasChangesThatAffectsAllPanels = false;
        this.startRefresh();
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
            for (var _c = __values(this.panels), _d = _c.next(); !_d.done; _d = _c.next()) {
                var panel = _d.value;
                if (panel.id > max) {
                    max = panel.id;
                }
                if (panel.collapsed) {
                    try {
                        for (var _e = (e_5 = void 0, __values(panel.panels)), _f = _e.next(); !_f.done; _f = _e.next()) {
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
        if (this.panelInEdit && this.panelInEdit.id === id) {
            return this.panelInEdit;
        }
        try {
            for (var _b = __values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
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
    DashboardModel.prototype.canEditPanel = function (panel) {
        return Boolean(this.meta.canEdit && panel && !panel.repeatPanelId && panel.type !== 'row');
    };
    DashboardModel.prototype.canEditPanelById = function (id) {
        return this.canEditPanel(this.getPanelById(id));
    };
    DashboardModel.prototype.addPanel = function (panelData) {
        panelData.id = this.getNextPanelId();
        this.panels.unshift(new PanelModel(panelData));
        this.sortPanelsByGridPos();
        this.events.publish(new DashboardPanelsChangedEvent());
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
    DashboardModel.prototype.clearUnsavedChanges = function () {
        var e_7, _a;
        try {
            for (var _b = __values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                panel.configRev = 0;
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_7) throw e_7.error; }
        }
    };
    DashboardModel.prototype.hasUnsavedChanges = function () {
        var e_8, _a;
        try {
            for (var _b = __values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                if (panel.hasChanged) {
                    console.log('Panel has changed', panel);
                    return true;
                }
            }
        }
        catch (e_8_1) { e_8 = { error: e_8_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_8) throw e_8.error; }
        }
        return false;
    };
    DashboardModel.prototype.cleanUpRepeats = function () {
        var e_9, _a;
        if (this.isSnapshotTruthy() || !this.hasVariables()) {
            return;
        }
        this.iteration = (this.iteration || new Date().getTime()) + 1;
        var panelsToRemove = [];
        try {
            // cleanup scopedVars
            for (var _b = __values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                delete panel.scopedVars;
            }
        }
        catch (e_9_1) { e_9 = { error: e_9_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_9) throw e_9.error; }
        }
        for (var i = 0; i < this.panels.length; i++) {
            var panel = this.panels[i];
            if ((!panel.repeat || panel.repeatedByRow) && panel.repeatPanelId && panel.repeatIteration !== this.iteration) {
                panelsToRemove.push(panel);
            }
        }
        // remove panels
        pull.apply(void 0, __spreadArray([this.panels], __read(panelsToRemove), false));
        panelsToRemove.map(function (p) { return p.destroy(); });
        this.sortPanelsByGridPos();
        this.events.publish(new DashboardPanelsChangedEvent());
    };
    DashboardModel.prototype.processRepeats = function () {
        if (this.isSnapshotTruthy() || !this.hasVariables()) {
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
        this.events.publish(new DashboardPanelsChangedEvent());
    };
    DashboardModel.prototype.cleanUpRowRepeats = function (rowPanels) {
        var panelsToRemove = [];
        for (var i = 0; i < rowPanels.length; i++) {
            var panel = rowPanels[i];
            if (!panel.repeat && panel.repeatPanelId) {
                panelsToRemove.push(panel);
            }
        }
        pull.apply(void 0, __spreadArray([rowPanels], __read(panelsToRemove), false));
        pull.apply(void 0, __spreadArray([this.panels], __read(panelsToRemove), false));
    };
    DashboardModel.prototype.processRowRepeats = function (row) {
        if (this.isSnapshotTruthy() || !this.hasVariables()) {
            return;
        }
        var rowPanels = row.panels;
        if (!row.collapsed) {
            var rowPanelIndex = findIndex(this.panels, function (p) { return p.id === row.id; });
            rowPanels = this.getRowPanels(rowPanelIndex);
        }
        this.cleanUpRowRepeats(rowPanels);
        var _loop_1 = function (i) {
            var panel = rowPanels[i];
            if (panel.repeat) {
                var panelIndex = findIndex(this_1.panels, function (p) { return p.id === panel.id; });
                this_1.repeatPanel(panel, panelIndex);
            }
        };
        var this_1 = this;
        for (var i = 0; i < rowPanels.length; i++) {
            _loop_1(i);
        }
    };
    DashboardModel.prototype.getPanelRepeatClone = function (sourcePanel, valueIndex, sourcePanelIndex) {
        var _a;
        // if first clone return source
        if (valueIndex === 0) {
            return sourcePanel;
        }
        var m = sourcePanel.getSaveModel();
        m.id = this.getNextPanelId();
        var clone = new PanelModel(m);
        // insert after source panel + value index
        this.panels.splice(sourcePanelIndex + valueIndex, 0, clone);
        clone.repeatIteration = this.iteration;
        clone.repeatPanelId = sourcePanel.id;
        clone.repeat = undefined;
        if (((_a = this.panelInView) === null || _a === void 0 ? void 0 : _a.id) === clone.id) {
            clone.setIsViewing(true);
            this.panelInView = clone;
        }
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
            rowPanels = cloneDeep(sourceRowPanel.panels);
            clone.panels = rowPanels;
            // insert copied row after preceding row
            insertPos = sourcePanelIndex + valueIndex;
        }
        else {
            rowPanels = this.getRowPanels(sourcePanelIndex);
            clone.panels = map(rowPanels, function (panel) { return panel.getSaveModel(); });
            // insert copied row after preceding row's panels
            insertPos = sourcePanelIndex + (rowPanels.length + 1) * valueIndex;
        }
        this.panels.splice(insertPos, 0, clone);
        this.updateRepeatedPanelIds(clone);
        return clone;
    };
    DashboardModel.prototype.repeatPanel = function (panel, panelIndex) {
        var variable = this.getPanelRepeatVariable(panel);
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
                if (isOnTheSameGridRow(panel, this.panels[i])) {
                    continue;
                }
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
                each(rowPanels, function (rowPanel, i) {
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
                each(rowPanels, function (rowPanel, i) {
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
            // Update gridPos for panels below if we inserted more than 1 repeated row panel
            if (selectedOptions.length > 1) {
                for (var i = panelBelowIndex; i < this_2.panels.length; i++) {
                    this_2.panels[i].gridPos.y += yPos;
                }
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
        panel.key = "" + panel.id;
        panel.repeatIteration = this.iteration;
        if (repeatedByRow) {
            panel.repeatedByRow = true;
        }
        else {
            panel.repeat = undefined;
        }
        return panel;
    };
    DashboardModel.prototype.getSelectedVariableOptions = function (variable) {
        var selectedOptions;
        if (isAllVariable(variable)) {
            selectedOptions = variable.options.slice(1, variable.options.length);
        }
        else {
            selectedOptions = filter(variable.options, { selected: true });
        }
        return selectedOptions;
    };
    DashboardModel.prototype.getRowHeight = function (rowPanel) {
        if (!rowPanel.panels || rowPanel.panels.length === 0) {
            return 0;
        }
        var rowYPos = rowPanel.gridPos.y;
        var positions = map(rowPanel.panels, 'gridPos');
        var maxPos = maxBy(positions, function (pos) {
            return pos.y + pos.h;
        });
        return maxPos.y + maxPos.h - rowYPos;
    };
    DashboardModel.prototype.removePanel = function (panel) {
        this.panels = this.panels.filter(function (item) { return item !== panel; });
        this.events.publish(new DashboardPanelsChangedEvent());
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
    DashboardModel.prototype.isSubMenuVisible = function () {
        if (this.links.length > 0) {
            return true;
        }
        if (this.getVariables().find(function (variable) { return variable.hide !== 2; })) {
            return true;
        }
        if (this.annotations.list.find(function (annotation) { return annotation.hide !== true; })) {
            return true;
        }
        return false;
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
        return dateTimeFormat(date, {
            format: format,
            timeZone: this.getTimezone(),
        });
    };
    DashboardModel.prototype.destroy = function () {
        var e_10, _a;
        this.events.removeAllListeners();
        try {
            for (var _b = __values(this.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var panel = _c.value;
                panel.destroy();
            }
        }
        catch (e_10_1) { e_10 = { error: e_10_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_10) throw e_10.error; }
        }
    };
    DashboardModel.prototype.toggleRow = function (row) {
        var e_11, _a;
        var rowIndex = indexOf(this.panels, row);
        if (row.collapsed) {
            row.collapsed = false;
            var hasRepeat = some(row.panels, function (p) { return p.repeat; });
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
                    for (var _b = __values(row.panels), _c = _b.next(); !_c.done; _c = _b.next()) {
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
                catch (e_11_1) { e_11 = { error: e_11_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_11) throw e_11.error; }
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
            this.events.publish(new DashboardPanelsChangedEvent());
            return;
        }
        var rowPanels = this.getRowPanels(rowIndex);
        // remove panels
        pull.apply(void 0, __spreadArray([this.panels], __read(rowPanels), false));
        // save panel models inside row panel
        row.panels = map(rowPanels, function (panel) { return panel.getSaveModel(); });
        row.collapsed = true;
        // emit change event
        this.events.publish(new DashboardPanelsChangedEvent());
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
    /** @deprecated */
    DashboardModel.prototype.on = function (event, callback) {
        console.log('DashboardModel.on is deprecated use events.subscribe');
        this.events.on(event, callback);
    };
    /** @deprecated */
    DashboardModel.prototype.off = function (event, callback) {
        console.log('DashboardModel.off is deprecated');
        this.events.off(event, callback);
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
        return dateTimeFormatTimeAgo(date, {
            timeZone: this.getTimezone(),
        });
    };
    DashboardModel.prototype.isSnapshot = function () {
        return this.snapshot !== undefined;
    };
    DashboardModel.prototype.getTimezone = function () {
        var _a;
        return (this.timezone ? this.timezone : (_a = contextSrv === null || contextSrv === void 0 ? void 0 : contextSrv.user) === null || _a === void 0 ? void 0 : _a.timezone);
    };
    DashboardModel.prototype.updateSchema = function (old) {
        var migrator = new DashboardMigrator(this);
        migrator.updateSchema(old);
    };
    DashboardModel.prototype.resetOriginalTime = function () {
        this.originalTime = cloneDeep(this.time);
    };
    DashboardModel.prototype.hasTimeChanged = function () {
        return !isEqual(this.time, this.originalTime);
    };
    DashboardModel.prototype.resetOriginalVariables = function (initial) {
        if (initial === void 0) { initial = false; }
        if (initial) {
            this.originalTemplating = this.cloneVariablesFrom(this.templating.list);
            return;
        }
        this.originalTemplating = this.cloneVariablesFrom(this.getVariablesFromState());
    };
    DashboardModel.prototype.hasVariableValuesChanged = function () {
        return this.hasVariablesChanged(this.originalTemplating, this.getVariablesFromState());
    };
    DashboardModel.prototype.autoFitPanels = function (viewHeight, kioskMode) {
        var currentGridHeight = Math.max.apply(Math, __spreadArray([], __read(this.panels.map(function (panel) {
            return panel.gridPos.h + panel.gridPos.y;
        })), false));
        var navbarHeight = 55;
        var margin = 20;
        var submenuHeight = 50;
        var visibleHeight = viewHeight - navbarHeight - margin;
        // Remove submenu height if visible
        if (this.meta.submenuEnabled && !kioskMode) {
            visibleHeight -= submenuHeight;
        }
        // add back navbar height
        if (kioskMode && kioskMode !== KioskMode.TV) {
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
        this.events.emit(CoreEvents.templateVariableValueUpdated);
    };
    DashboardModel.prototype.getPanelByUrlId = function (panelUrlId) {
        var e_12, _a, e_13, _b;
        var panelId = parseInt(panelUrlId !== null && panelUrlId !== void 0 ? panelUrlId : '0', 10);
        try {
            // First try to find it in a collapsed row and exand it
            for (var _c = __values(this.panels), _d = _c.next(); !_d.done; _d = _c.next()) {
                var panel = _d.value;
                if (panel.collapsed) {
                    try {
                        for (var _e = (e_13 = void 0, __values(panel.panels)), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var rowPanel = _f.value;
                            if (rowPanel.id === panelId) {
                                this.toggleRow(panel);
                                break;
                            }
                        }
                    }
                    catch (e_13_1) { e_13 = { error: e_13_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
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
        return this.getPanelById(panelId);
    };
    DashboardModel.prototype.toggleLegendsForAll = function () {
        var e_14, _a;
        var panelsWithLegends = this.panels.filter(function (panel) {
            return panel.legend !== undefined && panel.legend !== null;
        });
        // determine if more panels are displaying legends or not
        var onCount = panelsWithLegends.filter(function (panel) { return panel.legend.show; }).length;
        var offCount = panelsWithLegends.length - onCount;
        var panelLegendsOn = onCount >= offCount;
        try {
            for (var panelsWithLegends_1 = __values(panelsWithLegends), panelsWithLegends_1_1 = panelsWithLegends_1.next(); !panelsWithLegends_1_1.done; panelsWithLegends_1_1 = panelsWithLegends_1.next()) {
                var panel = panelsWithLegends_1_1.value;
                panel.legend.show = !panelLegendsOn;
                panel.render();
            }
        }
        catch (e_14_1) { e_14 = { error: e_14_1 }; }
        finally {
            try {
                if (panelsWithLegends_1_1 && !panelsWithLegends_1_1.done && (_a = panelsWithLegends_1.return)) _a.call(panelsWithLegends_1);
            }
            finally { if (e_14) throw e_14.error; }
        }
    };
    DashboardModel.prototype.canAddAnnotations = function () {
        return this.meta.canEdit || this.meta.canMakeEditable;
    };
    DashboardModel.prototype.shouldUpdateDashboardPanelFromJSON = function (updatedPanel, panel) {
        var shouldUpdateGridPositionLayout = !isEqual(updatedPanel === null || updatedPanel === void 0 ? void 0 : updatedPanel.gridPos, panel === null || panel === void 0 ? void 0 : panel.gridPos);
        if (shouldUpdateGridPositionLayout) {
            this.events.publish(new DashboardPanelsChangedEvent());
        }
    };
    DashboardModel.prototype.getPanelRepeatVariable = function (panel) {
        return this.getVariablesFromState().find(function (variable) { return variable.name === panel.repeat; });
    };
    DashboardModel.prototype.isSnapshotTruthy = function () {
        return this.snapshot;
    };
    DashboardModel.prototype.hasVariables = function () {
        return this.getVariablesFromState().length > 0;
    };
    DashboardModel.prototype.hasVariablesChanged = function (originalVariables, currentVariables) {
        if (originalVariables.length !== currentVariables.length) {
            return false;
        }
        var updated = map(currentVariables, function (variable) {
            return {
                name: variable.name,
                type: variable.type,
                current: cloneDeep(variable.current),
                filters: cloneDeep(variable.filters),
            };
        });
        return !isEqual(updated, originalVariables);
    };
    DashboardModel.prototype.cloneVariablesFrom = function (variables) {
        return variables.map(function (variable) {
            return {
                name: variable.name,
                type: variable.type,
                current: cloneDeep(variable.current),
                filters: cloneDeep(variable.filters),
            };
        });
    };
    DashboardModel.nonPersistedProperties = {
        events: true,
        meta: true,
        panels: true,
        templating: true,
        originalTime: true,
        originalTemplating: true,
        originalLibraryPanels: true,
        panelInEdit: true,
        panelInView: true,
        getVariablesFromState: true,
        formatDate: true,
        hasChangesThatAffectsAllPanels: true,
    };
    return DashboardModel;
}());
export { DashboardModel };
//# sourceMappingURL=DashboardModel.js.map