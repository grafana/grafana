import { cloneDeep, defaults as _defaults, filter, indexOf, isEqual, map, maxBy, pull } from 'lodash';
import { Subscription } from 'rxjs';
import { dateTime, dateTimeFormat, dateTimeFormatTimeAgo, EventBusSrv, } from '@grafana/data';
import { RefreshEvent, TimeRangeUpdatedEvent, config } from '@grafana/runtime';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT, REPEAT_DIR_VERTICAL } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { isAngularDatasourcePlugin } from 'app/features/plugins/angularDeprecation/utils';
import { variableAdapters } from 'app/features/variables/adapters';
import { onTimeRangeUpdated } from 'app/features/variables/state/actions';
import { getVariablesByKey } from 'app/features/variables/state/selectors';
import { CoreEvents, KioskMode } from 'app/types';
import { DashboardMetaChangedEvent, DashboardPanelsChangedEvent, RenderEvent } from 'app/types/events';
import { appEvents } from '../../../core/core';
import { dispatch } from '../../../store/store';
import { VariablesChanged, VariablesChangedInUrl, VariablesTimeRangeProcessDone, } from '../../variables/types';
import { isAllVariable } from '../../variables/utils';
import { getTimeSrv } from '../services/TimeSrv';
import { mergePanels } from '../utils/panelMerge';
import { DashboardMigrator } from './DashboardMigrator';
import { PanelModel, autoMigrateAngular } from './PanelModel';
import { deleteScopeVars, isOnTheSameGridRow } from './utils';
export class DashboardModel {
    constructor(data, meta, options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        this.timeRangeUpdatedDuringEdit = false;
        this.originalDashboard = null;
        this.getVariablesFromState = (_a = options === null || options === void 0 ? void 0 : options.getVariablesFromState) !== null && _a !== void 0 ? _a : getVariablesByKey;
        this.events = new EventBusSrv();
        this.id = data.id || null;
        // UID is not there for newly created dashboards
        this.uid = data.uid || null;
        this.revision = (_b = data.revision) !== null && _b !== void 0 ? _b : undefined;
        this.title = (_c = data.title) !== null && _c !== void 0 ? _c : 'No Title';
        this.description = data.description;
        this.tags = (_d = data.tags) !== null && _d !== void 0 ? _d : [];
        this.timezone = (_e = data.timezone) !== null && _e !== void 0 ? _e : '';
        this.weekStart = (_f = data.weekStart) !== null && _f !== void 0 ? _f : '';
        this.editable = data.editable !== false;
        this.graphTooltip = data.graphTooltip || 0;
        this.time = (_g = data.time) !== null && _g !== void 0 ? _g : { from: 'now-6h', to: 'now' };
        this.timepicker = (_h = data.timepicker) !== null && _h !== void 0 ? _h : {};
        this.liveNow = Boolean(data.liveNow);
        this.templating = this.ensureListExist(data.templating);
        this.annotations = this.ensureListExist(data.annotations);
        this.refresh = data.refresh || '';
        this.snapshot = data.snapshot;
        this.schemaVersion = (_j = data.schemaVersion) !== null && _j !== void 0 ? _j : 0;
        this.fiscalYearStartMonth = (_k = data.fiscalYearStartMonth) !== null && _k !== void 0 ? _k : 0;
        this.version = (_l = data.version) !== null && _l !== void 0 ? _l : 0;
        this.links = (_m = data.links) !== null && _m !== void 0 ? _m : [];
        this.gnetId = data.gnetId || null;
        this.panels = map((_o = data.panels) !== null && _o !== void 0 ? _o : [], (panelData) => new PanelModel(panelData));
        // Deep clone original dashboard to avoid mutations by object reference
        this.originalDashboard = cloneDeep(data);
        this.originalTemplating = cloneDeep(this.templating);
        this.originalTime = cloneDeep(this.time);
        this.ensurePanelsHaveUniqueIds();
        this.formatDate = this.formatDate.bind(this);
        this.initMeta(meta);
        this.updateSchema(data);
        // Auto-migrate old angular panels
        if ((options === null || options === void 0 ? void 0 : options.autoMigrateOldPanels) || !config.angularSupportEnabled || config.featureToggles.autoMigrateOldPanels) {
            for (const p of this.panelIterator()) {
                const newType = autoMigrateAngular[p.type];
                if (!p.autoMigrateFrom && newType) {
                    p.autoMigrateFrom = p.type;
                    p.type = newType;
                }
            }
        }
        this.addBuiltInAnnotationQuery();
        this.sortPanelsByGridPos();
        this.panelsAffectedByVariableChange = null;
        this.appEventsSubscription = new Subscription();
        this.lastRefresh = Date.now();
        this.appEventsSubscription.add(appEvents.subscribe(VariablesChanged, this.variablesChangedHandler.bind(this)));
        this.appEventsSubscription.add(appEvents.subscribe(VariablesTimeRangeProcessDone, this.variablesTimeRangeProcessDoneHandler.bind(this)));
        this.appEventsSubscription.add(appEvents.subscribe(VariablesChangedInUrl, this.variablesChangedInUrlHandler.bind(this)));
    }
    addBuiltInAnnotationQuery() {
        const found = this.annotations.list.some((item) => item.builtIn === 1);
        if (found) {
            return;
        }
        this.annotations.list.unshift({
            datasource: { uid: '-- Grafana --', type: 'grafana' },
            name: 'Annotations & Alerts',
            type: 'dashboard',
            iconColor: DEFAULT_ANNOTATION_COLOR,
            enable: true,
            hide: true,
            builtIn: 1,
        });
    }
    initMeta(meta) {
        meta = meta || {};
        meta.canShare = meta.canShare !== false;
        meta.canSave = meta.canSave !== false;
        meta.canStar = meta.canStar !== false;
        meta.canEdit = meta.canEdit !== false;
        meta.canDelete = meta.canDelete !== false;
        meta.showSettings = meta.canEdit;
        meta.canMakeEditable = meta.canSave && !this.editable;
        meta.hasUnsavedFolderChange = false;
        if (!this.editable) {
            meta.canEdit = false;
            meta.canDelete = false;
            meta.canSave = false;
        }
        this.meta = meta;
    }
    /**
     * @deprecated Returns the wrong type please do not use
     */
    getSaveModelCloneOld(options) {
        const optionsWithDefaults = _defaults(options || {}, {
            saveVariables: true,
            saveTimerange: true,
        });
        // make clone
        let copy = {};
        for (const property in this) {
            if (DashboardModel.nonPersistedProperties[property] || !this.hasOwnProperty(property)) {
                continue;
            }
            copy[property] = cloneDeep(this[property]);
        }
        copy.templating = this.getTemplatingSaveModel(optionsWithDefaults);
        if (!optionsWithDefaults.saveTimerange) {
            copy.time = this.originalTime;
        }
        // get panel save models
        copy.panels = this.getPanelSaveModels();
        //  sort by keys
        copy = sortedDeepCloneWithoutNulls(copy);
        copy.getVariables = () => copy.templating.list;
        return copy;
    }
    /**
     * Returns the persisted save model (schema) of the dashboard
     */
    getSaveModelClone(options) {
        const clone = this.getSaveModelCloneOld(options);
        // This is a bit messy / hacky but it's how we clean the model of any nulls / undefined / infinity
        const cloneJSON = JSON.stringify(clone);
        const cloneSafe = JSON.parse(cloneJSON);
        return cloneSafe;
    }
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
    updatePanels(panels) {
        var _a;
        const info = mergePanels(this.panels, panels !== null && panels !== void 0 ? panels : []);
        if (info.changed) {
            this.panels = (_a = info.panels) !== null && _a !== void 0 ? _a : [];
            this.sortPanelsByGridPos();
            this.events.publish(new DashboardPanelsChangedEvent());
        }
        return info;
    }
    getPanelSaveModels() {
        // Todo: Remove panel.type === 'add-panel' when we remove the emptyDashboardPage toggle
        return this.panels
            .filter((panel) => this.isSnapshotTruthy() || !(panel.type === 'add-panel' || panel.repeatPanelId || panel.repeatedByRow))
            .map((panel) => {
            // Clean libarary panels on save
            if (panel.libraryPanel) {
                const { id, title, libraryPanel, gridPos } = panel;
                return {
                    id,
                    title,
                    gridPos,
                    libraryPanel: {
                        uid: libraryPanel.uid,
                        name: libraryPanel.name,
                    },
                };
            }
            // If we save while editing we should include the panel in edit mode instead of the
            // unmodified source panel
            if (this.panelInEdit && this.panelInEdit.id === panel.id) {
                return this.panelInEdit.getSaveModel();
            }
            return panel.getSaveModel();
        })
            .map((model) => {
            if (this.isSnapshotTruthy()) {
                return model;
            }
            // Clear any scopedVars from persisted mode. This cannot be part of getSaveModel as we need to be able to copy
            // panel models with preserved scopedVars, for example when going into edit mode.
            delete model.scopedVars;
            // Clear any repeated panels from collapsed rows
            if (model.type === 'row' && model.panels && model.panels.length > 0) {
                model.panels = model.panels
                    .filter((rowPanel) => !rowPanel.repeatPanelId)
                    .map((model) => {
                    delete model.scopedVars;
                    return model;
                });
            }
            return model;
        });
    }
    getTemplatingSaveModel(options) {
        var _a, _b;
        const originalVariables = (_b = (_a = this.originalTemplating) === null || _a === void 0 ? void 0 : _a.list) !== null && _b !== void 0 ? _b : [];
        const currentVariables = this.getVariablesFromState(this.uid);
        const saveModels = currentVariables.map((variable) => {
            const variableSaveModel = variableAdapters.get(variable.type).getSaveModel(variable, options.saveVariables);
            if (!options.saveVariables) {
                const original = originalVariables.find(({ name, type }) => name === variable.name && type === variable.type);
                if (!original) {
                    return variableSaveModel;
                }
                if (variable.type === 'adhoc') {
                    variableSaveModel.filters = original.filters;
                }
                else {
                    variableSaveModel.current = original.current;
                    variableSaveModel.options = original.options;
                }
            }
            return variableSaveModel;
        });
        const saveModelsWithoutNull = sortedDeepCloneWithoutNulls(saveModels);
        return { list: saveModelsWithoutNull };
    }
    timeRangeUpdated(timeRange) {
        this.events.publish(new TimeRangeUpdatedEvent(timeRange));
        dispatch(onTimeRangeUpdated(this.uid, timeRange));
        if (this.panelInEdit) {
            this.timeRangeUpdatedDuringEdit = true;
        }
    }
    startRefresh(event = { refreshAll: true, panelIds: [] }) {
        this.events.publish(new RefreshEvent());
        this.lastRefresh = Date.now();
        if (this.panelInEdit && (event.refreshAll || event.panelIds.includes(this.panelInEdit.id))) {
            this.panelInEdit.refresh();
            return;
        }
        for (const panel of this.panels) {
            if (!this.otherPanelInFullscreen(panel) && (event.refreshAll || event.panelIds.includes(panel.id))) {
                panel.refresh();
            }
        }
    }
    render() {
        this.events.publish(new RenderEvent());
        for (const panel of this.panels) {
            panel.render();
        }
    }
    panelInitialized(panel) {
        const lastResult = panel.getQueryRunner().getLastResult();
        if (!this.otherPanelInFullscreen(panel) && !lastResult) {
            panel.refresh();
        }
    }
    otherPanelInFullscreen(panel) {
        return (this.panelInEdit || this.panelInView) && !(panel.isViewing || panel.isEditing);
    }
    initEditPanel(sourcePanel) {
        getTimeSrv().stopAutoRefresh();
        this.panelInEdit = sourcePanel.getEditClone();
        this.timeRangeUpdatedDuringEdit = false;
        return this.panelInEdit;
    }
    exitPanelEditor() {
        var _a;
        this.panelInEdit.destroy();
        this.panelInEdit = undefined;
        getTimeSrv().resumeAutoRefresh();
        if (this.panelsAffectedByVariableChange || this.timeRangeUpdatedDuringEdit) {
            this.startRefresh({
                panelIds: (_a = this.panelsAffectedByVariableChange) !== null && _a !== void 0 ? _a : [],
                refreshAll: this.timeRangeUpdatedDuringEdit,
            });
            this.panelsAffectedByVariableChange = null;
            this.timeRangeUpdatedDuringEdit = false;
        }
    }
    initViewPanel(panel) {
        this.panelInView = panel;
        panel.setIsViewing(true);
    }
    exitViewPanel(panel) {
        this.panelInView = undefined;
        panel.setIsViewing(false);
        this.refreshIfPanelsAffectedByVariableChange();
    }
    refreshIfPanelsAffectedByVariableChange() {
        if (!this.panelsAffectedByVariableChange) {
            return;
        }
        this.startRefresh({ panelIds: this.panelsAffectedByVariableChange, refreshAll: false });
        this.panelsAffectedByVariableChange = null;
    }
    ensurePanelsHaveUniqueIds() {
        const ids = new Set();
        let nextPanelId = this.getNextPanelId();
        for (const panel of this.panelIterator()) {
            if (!panel.id || ids.has(panel.id)) {
                panel.id = nextPanelId++;
            }
            ids.add(panel.id);
        }
    }
    ensureListExist(data = {}) {
        var _a;
        (_a = data.list) !== null && _a !== void 0 ? _a : (data.list = []);
        return data;
    }
    getNextPanelId() {
        let max = 0;
        for (const panel of this.panelIterator()) {
            if (panel.id > max) {
                max = panel.id;
            }
        }
        return max + 1;
    }
    *panelIterator() {
        var _a;
        for (const panel of this.panels) {
            yield panel;
            const rowPanels = (_a = panel.panels) !== null && _a !== void 0 ? _a : [];
            for (const rowPanel of rowPanels) {
                yield rowPanel;
            }
        }
    }
    forEachPanel(callback) {
        for (let i = 0; i < this.panels.length; i++) {
            callback(this.panels[i], i);
        }
    }
    getPanelById(id) {
        var _a;
        if (this.panelInEdit && this.panelInEdit.id === id) {
            return this.panelInEdit;
        }
        return (_a = this.panels.find((p) => p.id === id)) !== null && _a !== void 0 ? _a : null;
    }
    canEditPanel(panel) {
        return Boolean(this.meta.canEdit && panel && !panel.repeatPanelId && panel.type !== 'row');
    }
    canEditPanelById(id) {
        return this.canEditPanel(this.getPanelById(id));
    }
    addPanel(panelData) {
        panelData.id = this.getNextPanelId();
        this.panels.unshift(new PanelModel(panelData));
        this.sortPanelsByGridPos();
        this.events.publish(new DashboardPanelsChangedEvent());
    }
    updateMeta(updates) {
        this.meta = Object.assign(Object.assign({}, this.meta), updates);
        this.events.publish(new DashboardMetaChangedEvent());
    }
    makeEditable() {
        this.editable = true;
        this.updateMeta({
            canMakeEditable: false,
            canEdit: true,
            canSave: true,
        });
    }
    sortPanelsByGridPos() {
        this.panels.sort((panelA, panelB) => {
            if (panelA.gridPos.y === panelB.gridPos.y) {
                return panelA.gridPos.x - panelB.gridPos.x;
            }
            else {
                return panelA.gridPos.y - panelB.gridPos.y;
            }
        });
    }
    clearUnsavedChanges(savedModel, options) {
        for (const panel of this.panels) {
            panel.configRev = 0;
        }
        if (this.panelInEdit) {
            // Remember that we have a saved a change in panel editor so we apply it when leaving panel edit
            this.panelInEdit.hasSavedPanelEditChange = this.panelInEdit.configRev > 0;
            this.panelInEdit.configRev = 0;
        }
        this.originalDashboard = savedModel;
        this.originalTemplating = savedModel.templating;
        if (options.saveTimerange) {
            this.originalTime = savedModel.time;
        }
    }
    hasUnsavedChanges() {
        const changedPanel = this.panels.find((p) => p.hasChanged);
        return Boolean(changedPanel);
    }
    cleanUpRepeats() {
        if (this.isSnapshotTruthy() || !this.hasVariables()) {
            return;
        }
        // cleanup scopedVars
        deleteScopeVars(this.panels);
        const panelsToRemove = this.panels.filter((p) => (!p.repeat || p.repeatedByRow) && p.repeatPanelId);
        // remove panels
        pull(this.panels, ...panelsToRemove);
        panelsToRemove.map((p) => p.destroy());
        this.sortPanelsByGridPos();
    }
    processRepeats() {
        if (this.isSnapshotTruthy() || !this.hasVariables() || this.panelInView) {
            return;
        }
        this.cleanUpRepeats();
        for (let i = 0; i < this.panels.length; i++) {
            const panel = this.panels[i];
            if (panel.repeat) {
                this.repeatPanel(panel, i);
            }
        }
        this.sortPanelsByGridPos();
        this.events.publish(new DashboardPanelsChangedEvent());
    }
    cleanUpRowRepeats(rowPanels) {
        const panelIds = rowPanels.map((row) => row.id);
        // Remove repeated panels whose parent is in this row as these will be recreated later in processRowRepeats
        const panelsToRemove = rowPanels.filter((p) => !p.repeat && p.repeatPanelId && panelIds.includes(p.repeatPanelId));
        pull(rowPanels, ...panelsToRemove);
        pull(this.panels, ...panelsToRemove);
    }
    processRowRepeats(row) {
        var _a;
        if (this.isSnapshotTruthy() || !this.hasVariables()) {
            return;
        }
        let rowPanels = (_a = row.panels) !== null && _a !== void 0 ? _a : [];
        if (!row.collapsed) {
            const rowPanelIndex = this.panels.findIndex((p) => p.id === row.id);
            rowPanels = this.getRowPanels(rowPanelIndex);
        }
        this.cleanUpRowRepeats(rowPanels);
        for (const panel of rowPanels) {
            if (panel.repeat) {
                const panelIndex = this.panels.findIndex((p) => p.id === panel.id);
                this.repeatPanel(panel, panelIndex);
            }
        }
    }
    getPanelRepeatClone(sourcePanel, valueIndex, sourcePanelIndex) {
        var _a;
        // if first clone return source
        if (valueIndex === 0) {
            return sourcePanel;
        }
        const m = sourcePanel.getSaveModel();
        m.id = this.getNextPanelId();
        const clone = new PanelModel(m);
        // insert after source panel + value index
        this.panels.splice(sourcePanelIndex + valueIndex, 0, clone);
        clone.repeatPanelId = sourcePanel.id;
        clone.repeat = undefined;
        if (((_a = this.panelInView) === null || _a === void 0 ? void 0 : _a.id) === clone.id) {
            clone.setIsViewing(true);
            this.panelInView = clone;
        }
        return clone;
    }
    getRowRepeatClone(sourceRowPanel, valueIndex, sourcePanelIndex) {
        var _a;
        // if first clone, return source
        if (valueIndex === 0) {
            if (!sourceRowPanel.collapsed) {
                const rowPanels = this.getRowPanels(sourcePanelIndex);
                sourceRowPanel.panels = rowPanels;
            }
            return sourceRowPanel;
        }
        const clone = new PanelModel(sourceRowPanel.getSaveModel());
        // for row clones we need to figure out panels under row to clone and where to insert clone
        let rowPanels, insertPos;
        if (sourceRowPanel.collapsed) {
            rowPanels = (_a = cloneDeep(sourceRowPanel.panels)) !== null && _a !== void 0 ? _a : [];
            clone.panels = rowPanels;
            // insert copied row after preceding row
            insertPos = sourcePanelIndex + valueIndex;
        }
        else {
            rowPanels = this.getRowPanels(sourcePanelIndex);
            clone.panels = rowPanels.map((panel) => panel.getSaveModel());
            // insert copied row after preceding row's panels
            insertPos = sourcePanelIndex + (rowPanels.length + 1) * valueIndex;
        }
        this.panels.splice(insertPos, 0, clone);
        this.updateRepeatedPanelIds(clone);
        return clone;
    }
    repeatPanel(panel, panelIndex) {
        var _a;
        const variable = this.getPanelRepeatVariable(panel);
        if (!variable) {
            return;
        }
        if (panel.type === 'row') {
            this.repeatRow(panel, panelIndex, variable);
            return;
        }
        const selectedOptions = this.getSelectedVariableOptions(variable);
        const maxPerRow = panel.maxPerRow || 4;
        let xPos = 0;
        let yPos = panel.gridPos.y;
        for (let index = 0; index < selectedOptions.length; index++) {
            const option = selectedOptions[index];
            let copy;
            copy = this.getPanelRepeatClone(panel, index, panelIndex);
            (_a = copy.scopedVars) !== null && _a !== void 0 ? _a : (copy.scopedVars = {});
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
        const yOffset = yPos - panel.gridPos.y;
        if (yOffset > 0) {
            const panelBelowIndex = panelIndex + selectedOptions.length;
            for (const curPanel of this.panels.slice(panelBelowIndex)) {
                if (isOnTheSameGridRow(panel, curPanel)) {
                    continue;
                }
                curPanel.gridPos.y += yOffset;
            }
        }
    }
    repeatRow(panel, panelIndex, variable) {
        const selectedOptions = this.getSelectedVariableOptions(variable);
        for (let optionIndex = 0; optionIndex < selectedOptions.length; optionIndex++) {
            const curOption = selectedOptions[optionIndex];
            const rowClone = this.getRowRepeatClone(panel, optionIndex, panelIndex);
            setScopedVars(rowClone, variable, curOption);
            const rowHeight = this.getRowHeight(rowClone);
            const panelsInRow = rowClone.panels || [];
            let panelBelowIndex;
            if (panel.collapsed) {
                // For a collapsed row, just copy its panels, set scoped vars and proper IDs
                for (const panelInRow of panelsInRow) {
                    setScopedVars(panelInRow, variable, curOption);
                    if (optionIndex > 0) {
                        this.updateRepeatedPanelIds(panelInRow, true);
                    }
                }
                // push nth row clone's y-pos down by n
                rowClone.gridPos.y += optionIndex;
                panelBelowIndex = panelIndex + optionIndex + 1;
            }
            else {
                // insert after row panel
                const insertPos = panelIndex + (panelsInRow.length + 1) * optionIndex + 1;
                panelsInRow.forEach((panelInRow, i) => {
                    setScopedVars(panelInRow, variable, curOption);
                    if (optionIndex > 0) {
                        const panelInRowClone = new PanelModel(panelInRow);
                        this.updateRepeatedPanelIds(panelInRowClone, true);
                        // For exposed row, set correct grid y-position and add it to dashboard panels
                        panelInRowClone.gridPos.y += rowHeight * optionIndex;
                        this.panels.splice(insertPos + i, 0, panelInRowClone);
                    }
                });
                rowClone.panels = [];
                rowClone.gridPos.y += rowHeight * optionIndex;
                panelBelowIndex = insertPos + panelsInRow.length;
            }
            // Update gridPos for panels below if we inserted more than 1 repeated row panel
            if (selectedOptions.length > 1) {
                for (const panel of this.panels.slice(panelBelowIndex)) {
                    panel.gridPos.y += rowHeight;
                }
            }
        }
    }
    updateRepeatedPanelIds(panel, repeatedByRow) {
        panel.repeatPanelId = panel.id;
        panel.id = this.getNextPanelId();
        if (repeatedByRow) {
            panel.repeatedByRow = true;
        }
        else {
            panel.repeat = undefined;
        }
        return panel;
    }
    getSelectedVariableOptions(variable) {
        let selectedOptions;
        if (isAllVariable(variable)) {
            selectedOptions = variable.options.slice(1, variable.options.length);
        }
        else {
            selectedOptions = filter(variable.options, { selected: true });
        }
        return selectedOptions;
    }
    getRowHeight(rowPanel) {
        if (!rowPanel.panels || rowPanel.panels.length === 0) {
            return 0;
        }
        else if (rowPanel.collapsed) {
            // A collapsed row will always have height 1
            return 1;
        }
        const maxYPos = maxBy(rowPanel.panels, ({ gridPos }) => gridPos.y + gridPos.h).gridPos;
        return maxYPos.y + maxYPos.h - rowPanel.gridPos.y;
    }
    removePanel(panel) {
        this.panels = this.panels.filter((item) => item !== panel);
        this.events.publish(new DashboardPanelsChangedEvent());
    }
    removeRow(row, removePanels) {
        const needToggle = (!removePanels && row.collapsed) || (removePanels && !row.collapsed);
        if (needToggle) {
            this.toggleRow(row);
        }
        this.removePanel(row);
    }
    expandRows() {
        const collapsedRows = this.panels.filter((p) => p.type === 'row' && p.collapsed);
        for (const row of collapsedRows) {
            this.toggleRow(row);
        }
    }
    collapseRows() {
        const collapsedRows = this.panels.filter((p) => p.type === 'row' && !p.collapsed);
        for (const row of collapsedRows) {
            this.toggleRow(row);
        }
    }
    isSubMenuVisible() {
        return (this.links.length > 0 ||
            this.getVariables().some((variable) => variable.hide !== 2) ||
            this.annotations.list.some((annotation) => !annotation.hide));
    }
    getPanelInfoById(panelId) {
        const panelIndex = this.panels.findIndex((p) => p.id === panelId);
        return panelIndex >= 0 ? { panel: this.panels[panelIndex], index: panelIndex } : null;
    }
    duplicatePanel(panel) {
        const newPanel = panel.getSaveModel();
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
    }
    formatDate(date, format) {
        return dateTimeFormat(date, {
            format,
            timeZone: this.getTimezone(),
        });
    }
    destroy() {
        this.appEventsSubscription.unsubscribe();
        this.events.removeAllListeners();
        for (const panel of this.panels) {
            panel.destroy();
        }
    }
    toggleRow(row) {
        var _a, _b, _c, _d;
        const rowIndex = indexOf(this.panels, row);
        if (!row.collapsed) {
            const rowPanels = this.getRowPanels(rowIndex);
            // remove panels
            pull(this.panels, ...rowPanels);
            // save panel models inside row panel
            row.panels = rowPanels.map((panel) => panel.getSaveModel());
            row.collapsed = true;
            if (rowPanels.some((panel) => panel.hasChanged)) {
                row.configRev++;
            }
            // emit change event
            this.events.publish(new DashboardPanelsChangedEvent());
            return;
        }
        row.collapsed = false;
        const rowPanels = (_a = row.panels) !== null && _a !== void 0 ? _a : [];
        const hasRepeat = rowPanels.some((p) => p.repeat);
        // This is set only for the row being repeated.
        const rowRepeatVariable = row.repeat;
        if (rowPanels.length > 0) {
            // Use first panel to figure out if it was moved or pushed
            // If the panel doesn't have gridPos.y, use the row gridPos.y instead.
            // This can happen for some generated dashboards.
            const firstPanelYPos = (_b = rowPanels[0].gridPos.y) !== null && _b !== void 0 ? _b : row.gridPos.y;
            const yDiff = firstPanelYPos - (row.gridPos.y + row.gridPos.h);
            // start inserting after row
            let insertPos = rowIndex + 1;
            // y max will represent the bottom y pos after all panels have been added
            // needed to know home much panels below should be pushed down
            let yMax = row.gridPos.y;
            for (const panel of rowPanels) {
                // When expanding original row that's repeated, set scopedVars for repeated row panels.
                if (rowRepeatVariable) {
                    const variable = this.getPanelRepeatVariable(row);
                    (_c = panel.scopedVars) !== null && _c !== void 0 ? _c : (panel.scopedVars = {});
                    if (variable) {
                        const selectedOptions = this.getSelectedVariableOptions(variable);
                        panel.scopedVars = Object.assign(Object.assign({}, panel.scopedVars), { [variable.name]: selectedOptions[0] });
                    }
                }
                // set the y gridPos if it wasn't already set
                (_d = panel.gridPos.y) !== null && _d !== void 0 ? _d : (panel.gridPos.y = row.gridPos.y); // (Safari 13.1 lacks ??= support)
                // make sure y is adjusted (in case row moved while collapsed)
                panel.gridPos.y -= yDiff;
                // insert after row
                this.panels.splice(insertPos, 0, new PanelModel(panel));
                // update insert post and y max
                insertPos += 1;
                yMax = Math.max(yMax, panel.gridPos.y + panel.gridPos.h);
            }
            const pushDownAmount = yMax - row.gridPos.y - 1;
            // push panels below down
            for (const panel of this.panels.slice(insertPos)) {
                panel.gridPos.y += pushDownAmount;
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
    }
    /**
     * Will return all panels after rowIndex until it encounters another row
     */
    getRowPanels(rowIndex) {
        const panelsBelowRow = this.panels.slice(rowIndex + 1);
        const nextRowIndex = panelsBelowRow.findIndex((p) => p.type === 'row');
        // Take all panels up to next row, or all panels if there are no other rows
        const rowPanels = panelsBelowRow.slice(0, nextRowIndex >= 0 ? nextRowIndex : this.panels.length);
        return rowPanels;
    }
    /** @deprecated */
    on(event, callback) {
        console.log('DashboardModel.on is deprecated use events.subscribe');
        this.events.on(event, callback);
    }
    /** @deprecated */
    off(event, callback) {
        console.log('DashboardModel.off is deprecated');
        this.events.off(event, callback);
    }
    cycleGraphTooltip() {
        this.graphTooltip = (this.graphTooltip + 1) % 3;
    }
    sharedTooltipModeEnabled() {
        return this.graphTooltip > 0;
    }
    sharedCrosshairModeOnly() {
        return this.graphTooltip === 1;
    }
    getRelativeTime(date) {
        return dateTimeFormatTimeAgo(date, {
            timeZone: this.getTimezone(),
        });
    }
    isSnapshot() {
        return this.snapshot !== undefined;
    }
    getTimezone() {
        var _a;
        return this.timezone ? this.timezone : (_a = contextSrv === null || contextSrv === void 0 ? void 0 : contextSrv.user) === null || _a === void 0 ? void 0 : _a.timezone;
    }
    updateSchema(old) {
        const migrator = new DashboardMigrator(this);
        migrator.updateSchema(old);
    }
    hasTimeChanged() {
        const { time, originalTime } = this;
        // Compare moment values vs strings values
        return !(isEqual(time, originalTime) ||
            (isEqual(dateTime(time === null || time === void 0 ? void 0 : time.from), dateTime(originalTime === null || originalTime === void 0 ? void 0 : originalTime.from)) &&
                isEqual(dateTime(time === null || time === void 0 ? void 0 : time.to), dateTime(originalTime === null || originalTime === void 0 ? void 0 : originalTime.to))));
    }
    autoFitPanels(viewHeight, kioskMode) {
        const currentGridHeight = Math.max(...this.panels.map((panel) => panel.gridPos.h + panel.gridPos.y));
        const navbarHeight = 55;
        const margin = 20;
        let visibleHeight = viewHeight - navbarHeight - margin;
        // add back navbar height
        if (kioskMode && kioskMode !== KioskMode.TV) {
            visibleHeight += navbarHeight;
        }
        const visibleGridHeight = Math.floor(visibleHeight / (GRID_CELL_HEIGHT + GRID_CELL_VMARGIN));
        const scaleFactor = currentGridHeight / visibleGridHeight;
        for (const panel of this.panels) {
            panel.gridPos.y = Math.round(panel.gridPos.y / scaleFactor) || 1;
            panel.gridPos.h = Math.round(panel.gridPos.h / scaleFactor) || 1;
        }
    }
    templateVariableValueUpdated() {
        this.processRepeats();
        this.events.emit(CoreEvents.templateVariableValueUpdated);
    }
    getPanelByUrlId(panelUrlId) {
        var _a;
        const panelId = parseInt(panelUrlId !== null && panelUrlId !== void 0 ? panelUrlId : '0', 10);
        // First try to find it in a collapsed row and exand it
        const collapsedPanels = this.panels.filter((p) => p.collapsed);
        for (const panel of collapsedPanels) {
            const hasPanel = (_a = panel.panels) === null || _a === void 0 ? void 0 : _a.some((rp) => rp.id === panelId);
            hasPanel && this.toggleRow(panel);
        }
        return this.getPanelById(panelId);
    }
    toggleLegendsForAll() {
        const panelsWithLegends = this.panels.filter(isPanelWithLegend);
        // determine if more panels are displaying legends or not
        const onCount = panelsWithLegends.filter((panel) => panel.legend.show).length;
        const offCount = panelsWithLegends.length - onCount;
        const panelLegendsOn = onCount >= offCount;
        for (const panel of panelsWithLegends) {
            panel.legend.show = !panelLegendsOn;
            panel.render();
        }
    }
    toggleExemplarsForAll() {
        for (const panel of this.panels) {
            for (const target of panel.targets) {
                if (!(target.datasource && target.datasource.type === 'prometheus')) {
                    continue;
                }
                const promTarget = target;
                promTarget.exemplar = !promTarget.exemplar;
            }
        }
        this.startRefresh();
    }
    getVariables() {
        return this.getVariablesFromState(this.uid);
    }
    canEditAnnotations(dashboardUID) {
        var _a, _b;
        let canEdit = true;
        // dashboardUID is falsy when it is an organizational annotation
        if (!dashboardUID) {
            canEdit = !!((_a = this.meta.annotationsPermissions) === null || _a === void 0 ? void 0 : _a.organization.canEdit);
        }
        else {
            canEdit = !!((_b = this.meta.annotationsPermissions) === null || _b === void 0 ? void 0 : _b.dashboard.canEdit);
        }
        return this.canEditDashboard() && canEdit;
    }
    canDeleteAnnotations(dashboardUID) {
        var _a, _b;
        let canDelete = true;
        // dashboardUID is falsy when it is an organizational annotation
        if (!dashboardUID) {
            canDelete = !!((_a = this.meta.annotationsPermissions) === null || _a === void 0 ? void 0 : _a.organization.canDelete);
        }
        else {
            canDelete = !!((_b = this.meta.annotationsPermissions) === null || _b === void 0 ? void 0 : _b.dashboard.canDelete);
        }
        return canDelete && this.canEditDashboard();
    }
    canAddAnnotations() {
        var _a;
        // When the builtin annotations are disabled, we should not add any in the UI
        const found = this.annotations.list.find((item) => item.builtIn === 1);
        if ((found === null || found === void 0 ? void 0 : found.enable) === false || !this.canEditDashboard()) {
            return false;
        }
        // If RBAC is enabled there are additional conditions to check.
        return Boolean((_a = this.meta.annotationsPermissions) === null || _a === void 0 ? void 0 : _a.dashboard.canAdd);
    }
    canEditDashboard() {
        return Boolean(this.meta.canEdit || this.meta.canMakeEditable);
    }
    shouldUpdateDashboardPanelFromJSON(updatedPanel, panel) {
        const shouldUpdateGridPositionLayout = !isEqual(updatedPanel === null || updatedPanel === void 0 ? void 0 : updatedPanel.gridPos, panel === null || panel === void 0 ? void 0 : panel.gridPos);
        if (shouldUpdateGridPositionLayout) {
            this.events.publish(new DashboardPanelsChangedEvent());
        }
    }
    getDefaultTime() {
        return this.originalTime;
    }
    getPanelRepeatVariable(panel) {
        return this.getVariablesFromState(this.uid).find((variable) => variable.name === panel.repeat);
    }
    isSnapshotTruthy() {
        return this.snapshot;
    }
    hasVariables() {
        return this.getVariablesFromState(this.uid).length > 0;
    }
    hasVariablesChanged() {
        var _a, _b;
        const originalVariables = (_b = (_a = this.originalTemplating) === null || _a === void 0 ? void 0 : _a.list) !== null && _b !== void 0 ? _b : [];
        const currentVariables = this.getTemplatingSaveModel({ saveVariables: true }).list;
        if (originalVariables.length !== currentVariables.length) {
            return false;
        }
        return !isEqual(currentVariables, originalVariables);
    }
    variablesTimeRangeProcessDoneHandler(event) {
        const processRepeats = event.payload.variableIds.length > 0;
        this.variablesChangedHandler(new VariablesChanged({ panelIds: [], refreshAll: true }), processRepeats);
    }
    variablesChangedHandler(event, processRepeats = true) {
        if (processRepeats) {
            this.processRepeats();
        }
        if (event.payload.refreshAll || getTimeSrv().isRefreshOutsideThreshold(this.lastRefresh)) {
            this.startRefresh({ refreshAll: true, panelIds: [] });
            return;
        }
        if (this.panelInEdit || this.panelInView) {
            this.panelsAffectedByVariableChange = event.payload.panelIds.filter((id) => { var _a, _b, _c; return id !== ((_b = (_a = this.panelInEdit) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : (_c = this.panelInView) === null || _c === void 0 ? void 0 : _c.id); });
        }
        this.startRefresh(event.payload);
    }
    variablesChangedInUrlHandler(event) {
        this.templateVariableValueUpdated();
        this.startRefresh(event.payload);
    }
    getOriginalDashboard() {
        return this.originalDashboard;
    }
    hasAngularPlugins() {
        return this.panels.some((panel) => { var _a, _b; return panel.isAngularPlugin() || (((_a = panel.datasource) === null || _a === void 0 ? void 0 : _a.uid) ? isAngularDatasourcePlugin((_b = panel.datasource) === null || _b === void 0 ? void 0 : _b.uid) : false); });
    }
}
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
    appEventsSubscription: true,
    panelsAffectedByVariableChange: true,
    lastRefresh: true,
    timeRangeUpdatedDuringEdit: true,
    originalDashboard: true,
};
function isPanelWithLegend(panel) {
    return Boolean(panel.legend);
}
function setScopedVars(panel, variable, variableOption) {
    var _a;
    (_a = panel.scopedVars) !== null && _a !== void 0 ? _a : (panel.scopedVars = {});
    panel.scopedVars[variable.name] = variableOption;
}
//# sourceMappingURL=DashboardModel.js.map