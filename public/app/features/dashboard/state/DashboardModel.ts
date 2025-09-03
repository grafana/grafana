import { cloneDeep, defaults as _defaults, filter, indexOf, isEqual, map, maxBy, pull } from 'lodash';
import { Subscription } from 'rxjs';

import {
  AnnotationQuery,
  AppEvent,
  DashboardCursorSync,
  dateTime,
  dateTimeFormat,
  dateTimeFormatTimeAgo,
  DateTimeInput,
  EventBusExtended,
  EventBusSrv,
  PanelModel as IPanelModel,
  TimeRange,
  TimeZone,
  TypedVariableModel,
  UrlQueryValue,
} from '@grafana/data';
import { PromQuery } from '@grafana/prometheus';
import { RefreshEvent, TimeRangeUpdatedEvent, config } from '@grafana/runtime';
import { Dashboard, DashboardLink, VariableModel } from '@grafana/schema';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT, REPEAT_DIR_VERTICAL } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { variableAdapters } from 'app/features/variables/adapters';
import { onTimeRangeUpdated } from 'app/features/variables/state/actions';
import { GetVariables, getVariablesByKey } from 'app/features/variables/state/selectors';
import { DashboardMeta } from 'app/types/dashboard';
import {
  DashboardMetaChangedEvent,
  DashboardPanelsChangedEvent,
  RenderEvent,
  templateVariableValueUpdated,
} from 'app/types/events';

import { appEvents } from '../../../core/core';
import { dispatch } from '../../../store/store';
import {
  VariablesChanged,
  VariablesChangedEvent,
  VariablesChangedInUrl,
  VariablesTimeRangeProcessDone,
} from '../../variables/types';
import { isAllVariable } from '../../variables/utils';
import { getTimeSrv } from '../services/TimeSrv';
import { mergePanels, PanelMergeInfo } from '../utils/panelMerge';

import { DashboardMigrator } from './DashboardMigrator';
import { PanelModel } from './PanelModel';
import { TimeModel } from './TimeModel';
import { deleteScopeVars, isOnTheSameGridRow } from './utils';

export interface CloneOptions {
  saveVariables?: boolean;
  saveTimerange?: boolean;
  message?: string;
}

export type DashboardLinkType = 'link' | 'dashboards';

/** @experimental */
export interface ScopeMeta {
  trait: string;
  groups: string[];
}

export class DashboardModel implements TimeModel {
  /** @deprecated use UID */
  id: any;
  // TODO: use propert type and fix all the places where uid is set to null
  uid: any;
  title: string;
  description: any;
  tags: any;
  style: any;
  timezone: any;
  weekStart: any;
  editable: any;
  graphTooltip: DashboardCursorSync;
  time: any;
  liveNow?: boolean;
  private originalTime: any;
  timepicker: any;
  templating: { list: any[] };
  private originalTemplating: any;
  annotations: { list: AnnotationQuery[] };
  refresh?: string;
  snapshot: any;
  schemaVersion: number;
  version: number;
  revision?: number; // Only used for dashboards managed by plugins
  links: DashboardLink[];
  gnetId: any;
  panels: PanelModel[];
  panelInEdit?: PanelModel;
  panelInView?: PanelModel;
  fiscalYearStartMonth?: number;
  scopeMeta?: ScopeMeta;
  private panelsAffectedByVariableChange: number[] | null;
  private appEventsSubscription: Subscription;
  private lastRefresh: number;
  private timeRangeUpdatedDuringEditOrView = false;
  private originalDashboard: Dashboard | null = null;

  // ------------------
  // not persisted
  // ------------------

  // repeat process cycles
  declare meta: DashboardMeta;
  events: EventBusExtended;
  private getVariablesFromState: GetVariables;

  static nonPersistedProperties: { [str: string]: boolean } = {
    events: true,
    meta: true,
    panels: true, // needs special handling
    templating: true, // needs special handling
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
    timeRangeUpdatedDuringEditOrView: true,
    originalDashboard: true,
  };

  constructor(
    data: Dashboard,
    meta?: DashboardMeta,
    options?: {
      // By default this uses variables from redux state
      getVariablesFromState?: GetVariables;
      // Target schema version for migration (defaults to latest)
      targetSchemaVersion?: number;
    }
  ) {
    this.getVariablesFromState = options?.getVariablesFromState ?? getVariablesByKey;
    this.events = new EventBusSrv();
    this.id = data.id || null;
    // UID is not there for newly created dashboards
    this.uid = data.uid || meta?.uid || null;
    this.revision = data.revision ?? undefined;
    this.title = data.title ?? 'No Title';
    this.description = data.description;
    this.tags = data.tags ?? [];
    this.timezone = data.timezone ?? '';
    this.weekStart = data.weekStart ?? '';
    this.editable = data.editable !== false;
    this.graphTooltip = data.graphTooltip || 0;
    this.time = data.time ?? { from: 'now-6h', to: 'now' };
    this.timepicker = data.timepicker ?? {};
    this.liveNow = data.liveNow;
    this.templating = this.removeNullValuesFromVariables(this.ensureListExist(data.templating));
    this.annotations = this.ensureListExist(data.annotations);
    this.refresh = data.refresh;
    this.snapshot = data.snapshot;
    this.schemaVersion = data.schemaVersion ?? 0;
    this.fiscalYearStartMonth = data.fiscalYearStartMonth ?? 0;
    this.version = data.version ?? 0;
    this.links = data.links ?? [];
    this.gnetId = data.gnetId || null;
    this.panels = map(data.panels ?? [], (panelData) => new PanelModel(panelData));
    // @ts-expect-error - experimental and it's not included in the schema
    this.scopeMeta = data.scopeMeta;
    // Deep clone original dashboard to avoid mutations by object reference
    this.originalDashboard = cloneDeep(data);
    this.originalTemplating = cloneDeep(this.templating);
    this.originalTime = cloneDeep(this.time);

    this.ensurePanelsHaveUniqueIds();
    this.formatDate = this.formatDate.bind(this);

    this.initMeta(meta);
    this.updateSchema(data, options?.targetSchemaVersion);

    this.addBuiltInAnnotationQuery();
    this.sortPanelsByGridPos();
    this.panelsAffectedByVariableChange = null;
    this.appEventsSubscription = new Subscription();
    this.lastRefresh = Date.now();
    this.appEventsSubscription.add(appEvents.subscribe(VariablesChanged, this.variablesChangedHandler.bind(this)));
    this.appEventsSubscription.add(
      appEvents.subscribe(VariablesTimeRangeProcessDone, this.variablesTimeRangeProcessDoneHandler.bind(this))
    );
    this.appEventsSubscription.add(
      appEvents.subscribe(VariablesChangedInUrl, this.variablesChangedInUrlHandler.bind(this))
    );
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

  private initMeta(meta?: DashboardMeta) {
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
  getSaveModelCloneOld(options?: CloneOptions): DashboardModel {
    const optionsWithDefaults = _defaults(options || {}, {
      saveVariables: true,
      saveTimerange: true,
    });

    // make clone
    let copy: any = {};
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
  getSaveModelClone(options?: CloneOptions): Dashboard {
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
  // TODO: remove this as it's not being used anymore
  // Also remove public/app/features/dashboard/utils/panelMerge.ts
  updatePanels(panels: IPanelModel[]): PanelMergeInfo {
    const info = mergePanels(this.panels, panels ?? []);
    if (info.changed) {
      this.panels = info.panels ?? [];
      this.sortPanelsByGridPos();
      this.events.publish(new DashboardPanelsChangedEvent());
    }
    return info;
  }

  private getPanelSaveModels() {
    return this.panels
      .filter((panel) => this.isSnapshotTruthy() || !(panel.repeatPanelId || panel.repeatedByRow))
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
            .filter((rowPanel: PanelModel) => !rowPanel.repeatPanelId)
            .map((model: PanelModel) => {
              delete model.scopedVars;
              return model;
            });
        }

        return model;
      });
  }

  private getTemplatingSaveModel(options: CloneOptions) {
    const originalVariables = this.originalTemplating?.list ?? [];
    const currentVariables = this.getVariablesFromState(this.uid);

    const saveModels = currentVariables.map((variable) => {
      const variableSaveModel = variableAdapters.get(variable.type).getSaveModel(variable, options.saveVariables);

      if (!options.saveVariables) {
        const original = originalVariables.find(
          ({ name, type }: any) => name === variable.name && type === variable.type
        );

        if (!original) {
          return variableSaveModel;
        }

        if (variable.type === 'adhoc') {
          variableSaveModel.filters = original.filters;
        } else {
          variableSaveModel.current = original.current;
          variableSaveModel.options = original.options;
        }
      }

      return variableSaveModel;
    });

    const saveModelsWithoutNull = sortedDeepCloneWithoutNulls(saveModels);
    return { list: saveModelsWithoutNull };
  }

  timeRangeUpdated(timeRange: TimeRange) {
    this.events.publish(new TimeRangeUpdatedEvent(timeRange));
    dispatch(onTimeRangeUpdated(this.uid, timeRange));

    if (this.panelInEdit || this.panelInView) {
      this.timeRangeUpdatedDuringEditOrView = true;
    }
  }

  startRefresh(event: VariablesChangedEvent = { refreshAll: true, panelIds: [] }) {
    this.events.publish(new RefreshEvent());
    this.lastRefresh = Date.now();

    if (this.panelInEdit && (event.refreshAll || event.panelIds.includes(this.panelInEdit.id))) {
      this.panelInEdit.refresh();
      return;
    }

    const panelsToRefresh = this.panels.filter(
      (panel) => !this.otherPanelInFullscreen(panel) && (event.refreshAll || event.panelIds.includes(panel.id))
    );

    // We have to mark every panel as refreshWhenInView /before/ we actually refresh any
    // in case there is a shared query, as otherwise that might refresh before the source panel is
    // marked for refresh, preventing the panel from updating
    if (!this.isSnapshot()) {
      for (const panel of panelsToRefresh) {
        panel.refreshWhenInView = true;
      }
    }

    for (const panel of panelsToRefresh) {
      panel.refresh();
    }
  }

  render() {
    this.events.publish(new RenderEvent());
    for (const panel of this.panels) {
      panel.render();
    }
  }

  panelInitialized(panel: PanelModel) {
    const lastResult = panel.getQueryRunner().getLastResult();

    if (!this.otherPanelInFullscreen(panel) && !lastResult) {
      panel.refresh();
    }
  }

  otherPanelInFullscreen(panel: PanelModel) {
    return (this.panelInEdit || this.panelInView) && !(panel.isViewing || panel.isEditing);
  }

  initEditPanel(sourcePanel: PanelModel): PanelModel {
    getTimeSrv().stopAutoRefresh();
    this.panelInEdit = sourcePanel.getEditClone();
    this.timeRangeUpdatedDuringEditOrView = false;
    return this.panelInEdit;
  }

  exitPanelEditor() {
    this.panelInEdit!.destroy();
    this.panelInEdit = undefined;

    getTimeSrv().resumeAutoRefresh();

    this.refreshIfPanelsAffectedByVariableChangeOrTimeRangeChanged();
  }

  initViewPanel(panel: PanelModel) {
    this.panelInView = panel;
    this.timeRangeUpdatedDuringEditOrView = false;
    panel.setIsViewing(true);
  }

  exitViewPanel(panel: PanelModel) {
    this.panelInView = undefined;
    panel.setIsViewing(false);
    this.refreshIfPanelsAffectedByVariableChangeOrTimeRangeChanged();
  }

  private refreshIfPanelsAffectedByVariableChangeOrTimeRangeChanged() {
    if (this.panelsAffectedByVariableChange || this.timeRangeUpdatedDuringEditOrView) {
      this.startRefresh({
        panelIds: this.panelsAffectedByVariableChange ?? [],
        refreshAll: this.timeRangeUpdatedDuringEditOrView,
      });
      this.panelsAffectedByVariableChange = null;
      this.timeRangeUpdatedDuringEditOrView = false;
    }
  }

  private ensurePanelsHaveUniqueIds() {
    const ids = new Set<number>();
    let nextPanelId = this.getNextPanelId();
    for (const panel of this.panelIterator()) {
      if (!panel.id || ids.has(panel.id)) {
        panel.id = nextPanelId++;
      }
      ids.add(panel.id);
    }
  }

  private removeNullValuesFromVariables(templating: { list: VariableModel[] }) {
    if (!templating.list.length) {
      return templating;
    }

    for (const variable of templating.list) {
      if (variable.current) {
        // this is a safeguard for null value that breaks scenes dashboards.
        //    expecting error at .includes(null) in order to not adjust
        //    VariableOption type to avoid breaking changes
        if (
          variable.current.value === null ||
          //@ts-expect-error
          (Array.isArray(variable.current.value) && variable.current.value.includes(null))
        ) {
          variable.current = undefined;
        }
      }
    }
    return templating;
  }

  private ensureListExist(data: any = {}) {
    data.list ??= [];
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
    for (const panel of this.panels) {
      yield panel;

      const rowPanels = panel.panels ?? [];
      for (const rowPanel of rowPanels) {
        yield rowPanel;
      }
    }
  }

  forEachPanel(callback: (panel: PanelModel, index: number) => void) {
    for (let i = 0; i < this.panels.length; i++) {
      callback(this.panels[i], i);
    }
  }

  getPanelById(id: number, includeCollapsed = false): PanelModel | null {
    if (this.panelInEdit && this.panelInEdit.id === id) {
      return this.panelInEdit;
    }

    if (includeCollapsed) {
      for (const panel of this.panelIterator()) {
        if (panel.id === id) {
          return panel;
        }
      }

      return null;
    } else {
      return this.panels.find((p) => p.id === id) ?? null;
    }
  }

  canEditPanel(panel?: PanelModel | null): boolean | undefined | null {
    return Boolean(this.meta.canEdit && panel && !panel.repeatPanelId && panel.type !== 'row');
  }

  canEditPanelById(id: number): boolean | undefined | null {
    return this.canEditPanel(this.getPanelById(id));
  }

  addPanel(panelData: any) {
    panelData.id = this.getNextPanelId();

    this.panels.unshift(new PanelModel(panelData));

    this.sortPanelsByGridPos();

    this.events.publish(new DashboardPanelsChangedEvent());
  }

  updateMeta(updates: Partial<DashboardMeta>) {
    this.meta = { ...this.meta, ...updates };
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
      } else {
        return panelA.gridPos.y - panelB.gridPos.y;
      }
    });
  }

  clearUnsavedChanges(savedModel: Dashboard, options: CloneOptions) {
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

  cleanUpRowRepeats(rowPanels: PanelModel[]) {
    const panelIds = rowPanels.map((row) => row.id);
    // Remove repeated panels whose parent is in this row as these will be recreated later in processRowRepeats
    const panelsToRemove = rowPanels.filter((p) => !p.repeat && p.repeatPanelId && panelIds.includes(p.repeatPanelId));

    pull(rowPanels, ...panelsToRemove);
    pull(this.panels, ...panelsToRemove);
  }

  processRowRepeats(row: PanelModel) {
    if (this.isSnapshotTruthy() || !this.hasVariables()) {
      return;
    }

    let rowPanels = row.panels ?? [];
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

  getPanelRepeatClone(sourcePanel: PanelModel, valueIndex: number, sourcePanelIndex: number) {
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

    if (this.panelInView?.id === clone.id) {
      clone.setIsViewing(true);
      this.panelInView = clone;
    }

    return clone;
  }

  getRowRepeatClone(sourceRowPanel: PanelModel, valueIndex: number, sourcePanelIndex: number) {
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
    let rowPanels: PanelModel[], insertPos: number;
    if (sourceRowPanel.collapsed) {
      rowPanels = cloneDeep(sourceRowPanel.panels) ?? [];
      clone.panels = rowPanels;

      // insert copied row after preceding row
      insertPos = sourcePanelIndex + valueIndex;
    } else {
      rowPanels = this.getRowPanels(sourcePanelIndex);
      clone.panels = rowPanels.map((panel) => panel.getSaveModel());

      // insert copied row after preceding row's panels
      insertPos = sourcePanelIndex + (rowPanels.length + 1) * valueIndex;
    }
    this.panels.splice(insertPos, 0, clone);

    this.updateRepeatedPanelIds(clone);
    return clone;
  }

  repeatPanel(panel: PanelModel, panelIndex: number) {
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
      copy.scopedVars ??= {};
      copy.scopedVars[variable.name] = option;

      if (panel.repeatDirection === REPEAT_DIR_VERTICAL) {
        if (index > 0) {
          yPos += copy.gridPos.h;
        }
        copy.gridPos.y = yPos;
      } else {
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

  repeatRow(panel: PanelModel, panelIndex: number, variable: TypedVariableModel) {
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
      } else {
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

  updateRepeatedPanelIds(panel: PanelModel, repeatedByRow?: boolean) {
    panel.repeatPanelId = panel.id;
    panel.id = this.getNextPanelId();

    if (repeatedByRow) {
      panel.repeatedByRow = true;
    } else {
      panel.repeat = undefined;
    }

    return panel;
  }

  getSelectedVariableOptions(variable: any) {
    let selectedOptions: any[];
    if (isAllVariable(variable)) {
      selectedOptions = variable.options.slice(1, variable.options.length);
    } else {
      selectedOptions = filter(variable.options, { selected: true });
    }
    return selectedOptions;
  }

  getRowHeight(rowPanel: PanelModel): number {
    if (!rowPanel.panels || rowPanel.panels.length === 0) {
      return 0;
    } else if (rowPanel.collapsed) {
      // A collapsed row will always have height 1
      return 1;
    }

    const maxYPos = maxBy(rowPanel.panels, ({ gridPos }) => gridPos.y + gridPos.h)!.gridPos;
    return maxYPos.y + maxYPos.h - rowPanel.gridPos.y;
  }

  removePanel(panel: PanelModel) {
    this.panels = this.panels.filter((item) => item !== panel);
    panel.destroy();
    this.events.publish(new DashboardPanelsChangedEvent());
  }

  removeRow(row: PanelModel, removePanels: boolean) {
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
    return (
      this.links.length > 0 ||
      this.getVariables().some((variable) => variable.hide !== 2) ||
      this.annotations.list.some((annotation) => !annotation.hide)
    );
  }

  getPanelInfoById(panelId: number) {
    const panelIndex = this.panels.findIndex((p) => p.id === panelId);
    return panelIndex >= 0 ? { panel: this.panels[panelIndex], index: panelIndex } : null;
  }

  duplicatePanel(panel: PanelModel) {
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
    } else {
      // add below
      newPanel.gridPos.y += panel.gridPos.h;
    }

    this.addPanel(newPanel);
    return newPanel;
  }

  formatDate(date: DateTimeInput, format?: string) {
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

  toggleRow(row: PanelModel) {
    const rowIndex = indexOf(this.panels, row);

    if (!row.collapsed) {
      const rowPanels = this.getRowPanels(rowIndex);

      // remove panels
      pull(this.panels, ...rowPanels);
      // save panel models inside row panel
      row.panels = rowPanels.map((panel: PanelModel) => panel.getSaveModel());
      row.collapsed = true;

      if (rowPanels.some((panel) => panel.hasChanged)) {
        row.configRev++;
      }

      // emit change event
      this.events.publish(new DashboardPanelsChangedEvent());
      return;
    }

    row.collapsed = false;
    const rowPanels = row.panels ?? [];
    const hasRepeat = rowPanels.some((p: PanelModel) => p.repeat);

    // This is set only for the row being repeated.
    const rowRepeatVariable = row.repeat;

    if (rowPanels.length > 0) {
      // Use first panel to figure out if it was moved or pushed
      // If the panel doesn't have gridPos.y, use the row gridPos.y instead.
      // This can happen for some generated dashboards.
      const firstPanelYPos = rowPanels[0].gridPos.y ?? row.gridPos.y;
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
          panel.scopedVars ??= {};
          if (variable) {
            const selectedOptions = this.getSelectedVariableOptions(variable);
            panel.scopedVars = {
              ...panel.scopedVars,
              [variable.name]: selectedOptions[0],
            };
          }
        }
        // set the y gridPos if it wasn't already set
        panel.gridPos.y ?? (panel.gridPos.y = row.gridPos.y); // (Safari 13.1 lacks ??= support)
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
  getRowPanels(rowIndex: number): PanelModel[] {
    const panelsBelowRow = this.panels.slice(rowIndex + 1);
    const nextRowIndex = panelsBelowRow.findIndex((p) => p.type === 'row');

    // Take all panels up to next row, or all panels if there are no other rows
    const rowPanels = panelsBelowRow.slice(0, nextRowIndex >= 0 ? nextRowIndex : this.panels.length);

    return rowPanels;
  }

  /** @deprecated */
  on<T>(event: AppEvent<T>, callback: (payload?: T) => void) {
    console.log('DashboardModel.on is deprecated use events.subscribe');
    this.events.on(event, callback);
  }

  /** @deprecated */
  off<T>(event: AppEvent<T>, callback: (payload?: T) => void) {
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

  getRelativeTime(date: DateTimeInput) {
    return dateTimeFormatTimeAgo(date, {
      timeZone: this.getTimezone(),
    });
  }

  isSnapshot() {
    return this.snapshot !== undefined;
  }

  getTimezone(): TimeZone {
    return this.timezone ? this.timezone : contextSrv?.user?.timezone;
  }

  private updateSchema(old: any, targetVersion?: number) {
    const migrator = new DashboardMigrator(this);
    migrator.updateSchema(old, targetVersion);
  }

  hasTimeChanged() {
    const { time, originalTime } = this;

    // Compare moment values vs strings values
    return !(
      isEqual(time, originalTime) ||
      (isEqual(dateTime(time?.from), dateTime(originalTime?.from)) &&
        isEqual(dateTime(time?.to), dateTime(originalTime?.to)))
    );
  }

  autoFitPanels(viewHeight: number, kioskMode?: UrlQueryValue) {
    const currentGridHeight = Math.max(...this.panels.map((panel) => panel.gridPos.h + panel.gridPos.y));

    const navbarHeight = 55;
    const margin = 20;

    let visibleHeight = viewHeight - navbarHeight - margin;

    // add back navbar height
    if (kioskMode) {
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
    this.events.emit(templateVariableValueUpdated);
  }

  getPanelByUrlId(panelUrlId: string) {
    const panelId = parseInt(panelUrlId ?? '0', 10);

    // First try to find it in a collapsed row and exand it
    const collapsedPanels = this.panels.filter((p) => p.collapsed);
    for (const panel of collapsedPanels) {
      const hasPanel = panel.panels?.some((rp) => rp.id === panelId);
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
        if (
          !(
            target.datasource &&
            (target.datasource.type === 'prometheus' ||
              target.datasource.type === 'grafana-amazonprometheus-datasource' ||
              target.datasource.type === 'grafana-azureprometheus-datasource')
          )
        ) {
          continue;
        }

        const promTarget = target as PromQuery;
        promTarget.exemplar = !promTarget.exemplar;
      }
    }

    this.startRefresh();
  }

  getVariables() {
    return this.getVariablesFromState(this.uid);
  }

  canEditAnnotations(dashboardUID?: string) {
    let canEdit = true;

    // dashboardUID is falsy when it is an organizational annotation
    if (!dashboardUID) {
      canEdit = !!this.meta.annotationsPermissions?.organization.canEdit;
    } else {
      canEdit = !!this.meta.annotationsPermissions?.dashboard.canEdit;
    }

    if (config.featureToggles.annotationPermissionUpdate) {
      return canEdit;
    }
    return this.canEditDashboard() && canEdit;
  }

  canDeleteAnnotations(dashboardUID?: string) {
    let canDelete = true;

    // dashboardUID is falsy when it is an organizational annotation
    if (!dashboardUID) {
      canDelete = !!this.meta.annotationsPermissions?.organization.canDelete;
    } else {
      canDelete = !!this.meta.annotationsPermissions?.dashboard.canDelete;
    }

    if (config.featureToggles.annotationPermissionUpdate) {
      return canDelete;
    }
    return canDelete && this.canEditDashboard();
  }

  canAddAnnotations() {
    // When the builtin annotations are disabled, we should not add any in the UI
    const found = this.annotations.list.find((item) => item.builtIn === 1);
    if (found?.enable === false) {
      return false;
    }

    // If RBAC is enabled there are additional conditions to check.
    if (config.featureToggles.annotationPermissionUpdate) {
      return Boolean(this.meta.annotationsPermissions?.dashboard.canAdd);
    }

    return Boolean(this.meta.annotationsPermissions?.dashboard.canAdd) && this.canEditDashboard();
  }

  canEditDashboard() {
    return Boolean(this.meta.canEdit || this.meta.canMakeEditable);
  }

  shouldUpdateDashboardPanelFromJSON(updatedPanel: PanelModel, panel: PanelModel) {
    const shouldUpdateGridPositionLayout = !isEqual(updatedPanel?.gridPos, panel?.gridPos);
    if (shouldUpdateGridPositionLayout) {
      this.events.publish(new DashboardPanelsChangedEvent());
    }
  }

  getDefaultTime() {
    return this.originalTime;
  }

  private getPanelRepeatVariable(panel: PanelModel) {
    return this.getVariablesFromState(this.uid).find((variable) => variable.name === panel.repeat);
  }

  private isSnapshotTruthy() {
    return this.snapshot;
  }

  private hasVariables() {
    return this.getVariablesFromState(this.uid).length > 0;
  }

  public hasVariablesChanged(): boolean {
    const originalVariables = this.originalTemplating?.list ?? [];
    const currentVariables = this.getTemplatingSaveModel({ saveVariables: true }).list;

    if (originalVariables.length !== currentVariables.length) {
      return false;
    }

    return !isEqual(currentVariables, originalVariables);
  }

  private variablesTimeRangeProcessDoneHandler(event: VariablesTimeRangeProcessDone) {
    const processRepeats = event.payload.variableIds.length > 0;
    this.variablesChangedHandler(new VariablesChanged({ panelIds: [], refreshAll: true }), processRepeats);
  }

  private variablesChangedHandler(event: VariablesChanged, processRepeats = true) {
    if (processRepeats) {
      this.processRepeats();
    }

    if (event.payload.refreshAll || getTimeSrv().isRefreshOutsideThreshold(this.lastRefresh)) {
      this.startRefresh({ refreshAll: true, panelIds: [] });
      return;
    }

    if (this.panelInEdit || this.panelInView) {
      this.panelsAffectedByVariableChange = event.payload.panelIds.filter(
        (id) => id !== (this.panelInEdit?.id ?? this.panelInView?.id)
      );
    }

    this.startRefresh(event.payload);
  }

  private variablesChangedInUrlHandler(event: VariablesChangedInUrl) {
    this.templateVariableValueUpdated();
    this.startRefresh(event.payload);
  }

  getOriginalDashboard() {
    return this.originalDashboard;
  }
}

function isPanelWithLegend(panel: PanelModel): panel is PanelModel & Pick<Required<PanelModel>, 'legend'> {
  return Boolean(panel.legend);
}

function setScopedVars(panel: PanelModel, variable: TypedVariableModel, variableOption: any) {
  panel.scopedVars ??= {};
  panel.scopedVars[variable.name] = variableOption;
}
