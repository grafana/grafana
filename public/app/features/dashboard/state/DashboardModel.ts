import {
  cloneDeep,
  defaults as _defaults,
  each,
  find,
  findIndex,
  indexOf,
  isEqual,
  map,
  maxBy,
  pull,
  some,
} from 'lodash';
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
  UrlQueryValue,
} from '@grafana/data';
import { RefreshEvent, TimeRangeUpdatedEvent } from '@grafana/runtime';
import { DEFAULT_ANNOTATION_COLOR } from '@grafana/ui';
import { GRID_CELL_HEIGHT, GRID_CELL_VMARGIN, GRID_COLUMN_COUNT, REPEAT_DIR_VERTICAL } from 'app/core/constants';
import { contextSrv } from 'app/core/services/context_srv';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { variableAdapters } from 'app/features/variables/adapters';
import { onTimeRangeUpdated } from 'app/features/variables/state/actions';
import { GetVariables, getVariablesByKey } from 'app/features/variables/state/selectors';
import { CoreEvents, DashboardMeta, KioskMode } from 'app/types';
import { DashboardPanelsChangedEvent, RenderEvent } from 'app/types/events';

import { appEvents } from '../../../core/core';
import { dispatch, store } from '../../../store/store';
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
import { GridPos, PanelModel } from './PanelModel';
import { TimeModel } from './TimeModel';
import { updateDashboard } from './reducers';
import { deleteScopeVars, isOnTheSameGridRow } from './utils';

export interface CloneOptions {
  saveVariables?: boolean;
  saveTimerange?: boolean;
  message?: string;
}

export type DashboardLinkType = 'link' | 'dashboards';

export interface Snapshot {
  timestamp: Date;
  originalUrl?: string;
}

export interface DashboardLink {
  icon: string;
  title: string;
  tooltip: string;
  type: DashboardLinkType;
  url: string;
  asDropdown: boolean;
  tags: any[];
  searchHits?: any[];
  targetBlank: boolean;
  keepTime: boolean;
  includeVars: boolean;
}

export class DashboardModel implements TimeModel {
  id: any;
  uid: string;
  autoUpdate: any;
  timezone: string;
  weekStart: any;
  editable: boolean;
  time: any;
  private originalTime: any;
  timepicker: any;
  templating: { list: any[] };
  private originalTemplating: any;
  annotations: { list: AnnotationQuery[] };
  refresh?: any;
  snapshot?: Snapshot;
  schemaVersion: number;
  version: number;
  revision: number;
  links: DashboardLink[];
  gnetId: any;
  panels: PanelModel[];
  panelInEdit?: PanelModel;
  panelInView?: PanelModel;
  fiscalYearStartMonth?: number;
  private panelsAffectedByVariableChange: number[] | null;
  private appEventsSubscription: Subscription;
  private lastRefresh: number;

  // ------------------
  // not persisted
  // ------------------

  // repeat process cycles
  iteration?: number;
  declare meta: DashboardMeta;
  events: EventBusExtended;

  static nonPersistedProperties = new Set([
    'events',
    'meta',
    'panels', // needs special handling
    'templating', // needs special handling
    'originalTime',
    'originalTemplating',
    'originalLibraryPanels',
    'panelInEdit',
    'panelInView',
    'getVariablesFromState',
    'formatDate',
    'appEventsSubscription',
    'panelsAffectedByVariableChange',
    'lastRefresh',
  ]);

  static reduxProps = new Set<Partial<keyof DashboardModel>>([
    'title',
    'tags',
    'liveNow',
    'graphTooltip',
    'description',
    'style',
  ]);

  constructor(data: any = {}, meta?: DashboardMeta, private getVariablesFromState: GetVariables = getVariablesByKey) {
    this.events = new EventBusSrv();
    this.id = data.id || null;
    this.uid = data.uid || null;
    this.revision = data.revision;
    this.autoUpdate = data.autoUpdate;
    this.timezone = data.timezone ?? '';
    this.weekStart = data.weekStart ?? '';
    this.editable = data.editable !== false;
    this.time = data.time ?? { from: 'now-6h', to: 'now' };
    this.timepicker = data.timepicker ?? {};
    this.templating = this.ensureListExists(data.templating);
    this.annotations = this.ensureListExists(data.annotations);
    this.refresh = data.refresh;
    this.snapshot = data.snapshot;
    this.schemaVersion = data.schemaVersion ?? 0;
    this.fiscalYearStartMonth = data.fiscalYearStartMonth ?? 0;
    this.version = data.version ?? 0;
    this.links = data.links ?? [];
    this.gnetId = data.gnetId || null;
    this.panels = map(data.panels ?? [], (panelData: any) => new PanelModel(panelData));
    this.ensurePanelsHaveIds();
    this.formatDate = this.formatDate.bind(this);

    dispatch(
      updateDashboard({
        title: data.title ?? 'No Title',
        liveNow: Boolean(data.liveNow),
        graphTooltip: data.graphTooltip ?? DashboardCursorSync.Off,
        description: data.description,
        tags: data.tags ?? [],
      })
    );

    this.resetOriginalVariables(true);
    this.resetOriginalTime();

    this.initMeta(meta);
    this.updateSchema(data);

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

  get title(): string {
    return store.getState().dashboard.title;
  }

  set title(newTitle: string) {
    dispatch(updateDashboard({ title: newTitle }));
  }

  get liveNow(): boolean {
    return store.getState().dashboard.liveNow;
  }

  set liveNow(live: boolean) {
    dispatch(updateDashboard({ liveNow: live }));
  }

  get graphTooltip(): DashboardCursorSync {
    return store.getState().dashboard.graphTooltip;
  }

  set graphTooltip(newVal: DashboardCursorSync) {
    dispatch(updateDashboard({ graphTooltip: newVal }));
  }

  get description(): string {
    return store.getState().dashboard.description;
  }

  set description(newDescription: string) {
    dispatch(updateDashboard({ description: newDescription }));
  }

  get style(): 'dark' | 'light' {
    return store.getState().dashboard.style;
  }

  set style(newStyle: 'dark' | 'light') {
    dispatch(updateDashboard({ style: newStyle }));
  }

  get tags(): string[] {
    return store.getState().dashboard.tags;
  }

  set tags(newTags: string[]) {
    dispatch(updateDashboard({ tags: newTags }));
  }

  addBuiltInAnnotationQuery() {
    const hasBuiltin = this.annotations.list.some((item) => item.builtIn === 1);

    if (hasBuiltin) {
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

    meta.showSettings = meta.canSave;
    meta.canMakeEditable = meta.canSave && !this.editable;
    meta.hasUnsavedFolderChange = false;

    if (!this.editable) {
      meta.canEdit = false;
      meta.canDelete = false;
      meta.canSave = false;
    }

    this.meta = meta;
  }

  // cleans meta data and other non persistent state
  getSaveModelClone(options: CloneOptions = {}): DashboardModel {
    const defaults = {
      saveVariables: true,
      saveTimerange: true,
      ...options,
    };

    // make clone
    let copy: any = {};
    for (const property in this) {
      if (DashboardModel.nonPersistedProperties.has(property) || !this.hasOwnProperty(property)) {
        continue;
      }

      copy[property] = cloneDeep(this[property]);
    }

    for (const property of DashboardModel.reduxProps) {
      copy[property] = cloneDeep(this[property]);
    }

    this.updateTemplatingSaveModelClone(copy, defaults);

    if (!defaults.saveTimerange) {
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
   * This will load a new dashboard, but keep existing panels unchanged
   *
   * This function can be used to implement:
   * 1. potentially faster loading dashboard loading
   * 2. dynamic dashboard behavior
   * 3. "live" dashboard editing
   *
   * @internal and experimental
   */
  updatePanels(panels: IPanelModel[] = []): PanelMergeInfo {
    const info = mergePanels(this.panels, panels);
    if (info.changed) {
      this.panels = info.panels ?? [];
      this.sortPanelsByGridPos();
      this.events.publish(new DashboardPanelsChangedEvent());
    }
    return info;
  }

  private getPanelSaveModels() {
    return this.panels
      .filter(
        (panel: PanelModel) =>
          this.isSnapshotTruthy() || (panel.type !== 'add-panel' && !panel.repeatPanelId && !panel.repeatedByRow)
      )
      .map((panel: PanelModel) => {
        // If we save while editing we should include the panel in edit mode instead of the
        // unmodified source panel
        return this.panelInEdit?.id === panel.id ? this.panelInEdit.getSaveModel() : panel.getSaveModel();
      })
      .map((model: any) => {
        if (this.isSnapshotTruthy()) {
          return model;
        }
        // Clear any scopedVars from persisted mode. This cannot be part of getSaveModel as we need to be able to copy
        // panel models with preserved scopedVars, for example when going into edit mode.
        delete model.scopedVars;

        // Clear any repeated panels from collapsed rows
        if (model.type === 'row' && model.panels?.length > 0) {
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

  private updateTemplatingSaveModelClone(
    copy: any,
    defaults: { saveTimerange: boolean; saveVariables: boolean } & CloneOptions
  ) {
    const originalVariables = this.originalTemplating;
    const currentVariables = this.getVariablesFromState(this.uid);

    copy.templating = {
      list: currentVariables.map((variable) =>
        variableAdapters.get(variable.type).getSaveModel(variable, defaults.saveVariables)
      ),
    };

    if (!defaults.saveVariables) {
      for (let i = 0; i < copy.templating.list.length; i++) {
        const current = copy.templating.list[i];
        const original: any = find(originalVariables, { name: current.name, type: current.type });

        if (!original) {
          continue;
        }

        if (current.type === 'adhoc') {
          copy.templating.list[i].filters = original.filters;
        } else {
          copy.templating.list[i].current = original.current;
        }
      }
    }
  }

  timeRangeUpdated(timeRange: TimeRange) {
    this.events.publish(new TimeRangeUpdatedEvent(timeRange));
    dispatch(onTimeRangeUpdated(this.uid, timeRange));
  }

  startRefresh(event: VariablesChangedEvent = { refreshAll: true, panelIds: [] }) {
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
    getTimeSrv().pauseAutoRefresh();
    this.panelInEdit = sourcePanel.getEditClone();
    return this.panelInEdit;
  }

  initViewPanel(panel: PanelModel) {
    this.panelInView = panel;
    panel.setIsViewing(true);
  }

  exitViewPanel(panel: PanelModel) {
    this.panelInView = undefined;
    panel.setIsViewing(false);
    this.refreshIfPanelsAffectedByVariableChange();
  }

  exitPanelEditor() {
    this.panelInEdit!.destroy();
    this.panelInEdit = undefined;
    getTimeSrv().resumeAutoRefresh();
    this.refreshIfPanelsAffectedByVariableChange();
  }

  private refreshIfPanelsAffectedByVariableChange() {
    if (!this.panelsAffectedByVariableChange) {
      return;
    }

    this.startRefresh({ panelIds: this.panelsAffectedByVariableChange, refreshAll: false });
    this.panelsAffectedByVariableChange = null;
  }

  private ensurePanelsHaveIds() {
    for (const panel of this.panels) {
      if (!panel.id) {
        panel.id = this.getNextPanelId();
      }

      if (panel.panels) {
        for (const rowPanel of panel.panels) {
          if (!rowPanel.id) {
            rowPanel.id = this.getNextPanelId();
          }
        }
      }
    }
  }

  private ensureListExists(data: any = {}) {
    if (!data.list) {
      data.list = [];
    }
    return data;
  }

  getNextPanelId() {
    let max = 0;

    for (const panel of this.panels) {
      if (panel.id > max) {
        max = panel.id;
      }

      if (panel.collapsed) {
        for (const rowPanel of panel.panels) {
          if (rowPanel.id > max) {
            max = rowPanel.id;
          }
        }
      }
    }

    return max + 1;
  }

  forEachPanel(callback: (panel: PanelModel, index: number) => void) {
    for (let i = 0; i < this.panels.length; i++) {
      callback(this.panels[i], i);
    }
  }

  getPanelById(id: number): PanelModel | null {
    if (this.panelInEdit?.id === id) {
      return this.panelInEdit;
    }

    return this.panels.find((panel) => panel.id === id) ?? null;
  }

  canEditPanel(panel?: PanelModel | null): boolean {
    return Boolean(this.meta.canEdit && panel && !panel.repeatPanelId && panel.type !== 'row');
  }

  canEditPanelById(id: number): boolean {
    return this.canEditPanel(this.getPanelById(id));
  }

  addPanel(panelData: any) {
    panelData.id = this.getNextPanelId();

    this.panels.unshift(new PanelModel(panelData));

    this.sortPanelsByGridPos();

    this.events.publish(new DashboardPanelsChangedEvent());
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

  clearUnsavedChanges() {
    for (const panel of this.panels) {
      panel.configRev = 0;
    }
  }

  hasUnsavedChanges() {
    return this.panels.some((panel) => panel.hasChanged);
  }

  cleanUpRepeats() {
    if (this.isSnapshotTruthy() || !this.hasVariables()) {
      return;
    }

    this.iteration = (this.iteration || new Date().getTime()) + 1;
    const panelsToRemove = [];

    // cleanup scopedVars
    deleteScopeVars(this.panels);

    for (const panel of this.panels) {
      if ((!panel.repeat || panel.repeatedByRow) && panel.repeatPanelId && panel.repeatIteration !== this.iteration) {
        panelsToRemove.push(panel);
      }
    }

    // remove panels
    pull(this.panels, ...panelsToRemove);
    panelsToRemove.map((p) => p.destroy());
    this.sortPanelsByGridPos();
  }

  processRepeats() {
    if (this.isSnapshotTruthy() || !this.hasVariables()) {
      return;
    }

    this.cleanUpRepeats();

    this.iteration = (this.iteration || new Date().getTime()) + 1;

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
    const panelsToRemove = [];
    for (const panel of rowPanels) {
      if (!panel.repeat && panel.repeatPanelId) {
        panelsToRemove.push(panel);
      }
    }
    pull(rowPanels, ...panelsToRemove);
    pull(this.panels, ...panelsToRemove);
  }

  processRowRepeats(row: PanelModel) {
    if (this.isSnapshotTruthy() || !this.hasVariables()) {
      return;
    }

    let rowPanels = row.panels;
    if (!row.collapsed) {
      const rowPanelIndex = findIndex(this.panels, (p: PanelModel) => p.id === row.id);
      rowPanels = this.getRowPanels(rowPanelIndex);
    }

    this.cleanUpRowRepeats(rowPanels);

    for (const panel of rowPanels) {
      if (panel.repeat) {
        const panelIndex = findIndex(this.panels, (p: PanelModel) => p.id === panel.id);
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

    clone.repeatIteration = this.iteration;
    clone.repeatPanelId = sourcePanel.id;
    clone.repeat = undefined;

    if (this.panelInView?.id === clone.id) {
      clone.setIsViewing(true);
      this.panelInView = clone;
    }

    return clone;
  }

  getRowRepeatClone(sourceRowPanel: PanelModel, valueIndex: number, sourcePanelIndex: number) {
    // if first clone return source
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
      rowPanels = cloneDeep(sourceRowPanel.panels);
      clone.panels = rowPanels;
      // insert copied row after preceding row
      insertPos = sourcePanelIndex + valueIndex;
    } else {
      rowPanels = this.getRowPanels(sourcePanelIndex);
      clone.panels = map(rowPanels, (panel: PanelModel) => panel.getSaveModel());
      // insert copied row after preceding row's panels
      insertPos = sourcePanelIndex + (rowPanels.length + 1) * valueIndex;
    }
    this.panels.splice(insertPos, 0, clone);

    this.updateRepeatedPanelIds(clone);
    return clone;
  }

  repeatPanel(panel: PanelModel, panelIndex: number) {
    const variable: any = this.getPanelRepeatVariable(panel);
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
      copy.scopedVars = copy.scopedVars || {};
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
      for (let i = panelBelowIndex; i < this.panels.length; i++) {
        if (isOnTheSameGridRow(panel, this.panels[i])) {
          continue;
        }

        this.panels[i].gridPos.y += yOffset;
      }
    }
  }

  repeatRow(panel: PanelModel, panelIndex: number, variable: any) {
    const selectedOptions = this.getSelectedVariableOptions(variable);
    let yPos = panel.gridPos.y;

    function setScopedVars(panel: PanelModel, variableOption: any) {
      panel.scopedVars = panel.scopedVars || {};
      panel.scopedVars[variable.name] = variableOption;
    }

    for (let optionIndex = 0; optionIndex < selectedOptions.length; optionIndex++) {
      const option = selectedOptions[optionIndex];
      const rowCopy = this.getRowRepeatClone(panel, optionIndex, panelIndex);
      setScopedVars(rowCopy, option);

      const rowHeight = this.getRowHeight(rowCopy);
      const rowPanels = rowCopy.panels || [];
      let panelBelowIndex;

      if (panel.collapsed) {
        // For collapsed row just copy its panels and set scoped vars and proper IDs
        each(rowPanels, (rowPanel: PanelModel, i: number) => {
          setScopedVars(rowPanel, option);
          if (optionIndex > 0) {
            this.updateRepeatedPanelIds(rowPanel, true);
          }
        });
        rowCopy.gridPos.y += optionIndex;
        yPos += optionIndex;
        panelBelowIndex = panelIndex + optionIndex + 1;
      } else {
        // insert after 'row' panel
        const insertPos = panelIndex + (rowPanels.length + 1) * optionIndex + 1;
        each(rowPanels, (rowPanel: PanelModel, i: number) => {
          setScopedVars(rowPanel, option);
          if (optionIndex > 0) {
            const cloneRowPanel = new PanelModel(rowPanel);
            this.updateRepeatedPanelIds(cloneRowPanel, true);
            // For exposed row additionally set proper Y grid position and add it to dashboard panels
            cloneRowPanel.gridPos.y += rowHeight * optionIndex;
            this.panels.splice(insertPos + i, 0, cloneRowPanel);
          }
        });
        rowCopy.panels = [];
        rowCopy.gridPos.y += rowHeight * optionIndex;
        yPos += rowHeight;
        panelBelowIndex = insertPos + rowPanels.length;
      }

      // Update gridPos for panels below if we inserted more than 1 repeated row panel
      if (selectedOptions.length > 1) {
        for (let i = panelBelowIndex; i < this.panels.length; i++) {
          this.panels[i].gridPos.y += yPos;
        }
      }
    }
  }

  updateRepeatedPanelIds(panel: PanelModel, repeatedByRow?: boolean) {
    panel.repeatPanelId = panel.id;
    panel.id = this.getNextPanelId();
    panel.repeatIteration = this.iteration;
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
      selectedOptions = variable.options.filter((o: any) => o.selected);
    }
    return selectedOptions;
  }

  getRowHeight(rowPanel: PanelModel): number {
    if (!rowPanel.panels || rowPanel.panels.length === 0) {
      return 0;
    }
    const rowYPos = rowPanel.gridPos.y;
    const positions = map(rowPanel.panels, 'gridPos');
    const maxPos = maxBy(positions, (pos: GridPos) => pos.y + pos.h);
    return maxPos!.y + maxPos!.h - rowYPos;
  }

  removePanel(panel: PanelModel) {
    this.panels = this.panels.filter((item) => item !== panel);
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
    for (const panel of this.panels) {
      if (panel.type !== 'row') {
        continue;
      }

      if (panel.collapsed) {
        this.toggleRow(panel);
      }
    }
  }

  collapseRows() {
    for (const panel of this.panels) {
      if (panel.type !== 'row') {
        continue;
      }

      if (!panel.collapsed) {
        this.toggleRow(panel);
      }
    }
  }

  isSubMenuVisible() {
    return (
      this.links.length > 0 ||
      this.getVariables().some((variable) => variable.hide !== 2) ||
      this.annotations.list.some((annotation) => annotation.hide !== true)
    );
  }

  getPanelInfoById(panelId: number) {
    const i = this.panels.findIndex((panel) => panel.id === panelId);
    return i >= 0 ? { panel: this.panels[i], index: i } : null;
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

    if (row.collapsed) {
      row.collapsed = false;
      const hasRepeat = some(row.panels as PanelModel[], (p: PanelModel) => p.repeat);

      if (row.panels.length > 0) {
        // Use first panel to figure out if it was moved or pushed
        // If the panel doesn't have gridPos.y, use the row gridPos.y instead.
        // This can happen for some generated dashboards.
        const firstPanelYPos = row.panels[0].gridPos.y ?? row.gridPos.y;
        const yDiff = firstPanelYPos - (row.gridPos.y + row.gridPos.h);

        // start inserting after row
        let insertPos = rowIndex + 1;
        // y max will represent the bottom y pos after all panels have been added
        // needed to know home much panels below should be pushed down
        let yMax = row.gridPos.y;

        for (const panel of row.panels) {
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
        for (let panelIndex = insertPos; panelIndex < this.panels.length; panelIndex++) {
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

    const rowPanels = this.getRowPanels(rowIndex);

    // remove panels
    pull(this.panels, ...rowPanels);
    // save panel models inside row panel
    row.panels = map(rowPanels, (panel: PanelModel) => panel.getSaveModel());
    row.collapsed = true;

    // emit change event
    this.events.publish(new DashboardPanelsChangedEvent());
  }

  /**
   * Will return all panels after rowIndex until it encounters another row
   */
  getRowPanels(rowIndex: number): PanelModel[] {
    const rowPanels = [];

    for (const panel of this.panels.slice(rowIndex + 1)) {
      // break when encountering another row
      if (panel.type === 'row') {
        break;
      }

      // this panel must belong to row
      rowPanels.push(panel);
    }

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
    return (this.timezone ? this.timezone : contextSrv?.user?.timezone) as TimeZone;
  }

  private updateSchema(old: any) {
    const migrator = new DashboardMigrator(this);
    migrator.updateSchema(old);
  }

  resetOriginalTime() {
    this.originalTime = cloneDeep(this.time);
  }

  hasTimeChanged() {
    const { time, originalTime } = this;
    if (isEqual(time, originalTime)) {
      return false;
    }

    // Compare momemt values vs strings values
    return !(
      isEqual(dateTime(time?.from), dateTime(originalTime?.from)) &&
      isEqual(dateTime(time?.to), dateTime(originalTime?.to))
    );
  }

  resetOriginalVariables(initial = false) {
    if (initial) {
      this.originalTemplating = this.cloneVariablesFrom(this.templating.list);
      return;
    }

    this.originalTemplating = this.cloneVariablesFrom(this.getVariablesFromState(this.uid));
  }

  hasVariableValuesChanged() {
    return this.hasVariablesChanged(this.originalTemplating, this.getVariablesFromState(this.uid));
  }

  autoFitPanels(viewHeight: number, kioskMode?: UrlQueryValue) {
    const currentGridHeight = Math.max(
      ...this.panels.map((panel) => {
        return panel.gridPos.h + panel.gridPos.y;
      })
    );

    const navbarHeight = 55;
    const margin = 20;
    const submenuHeight = 50;

    let visibleHeight = viewHeight - navbarHeight - margin;

    // Remove submenu height if visible
    if (this.meta.submenuEnabled && !kioskMode) {
      visibleHeight -= submenuHeight;
    }

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

  getPanelByUrlId(panelUrlId: string) {
    const panelId = parseInt(panelUrlId ?? '0', 10);

    // First try to find it in a collapsed row and exand it
    for (const panel of this.panels) {
      if (panel.collapsed) {
        for (const rowPanel of panel.panels) {
          if (rowPanel.id === panelId) {
            this.toggleRow(panel);
            break;
          }
        }
      }
    }

    return this.getPanelById(panelId);
  }

  toggleLegendsForAll() {
    const panelsWithLegends = this.panels.filter((panel) => panel.legend !== undefined && panel.legend !== null);

    // determine if more panels are displaying legends or not
    const onCount = panelsWithLegends.filter((panel) => panel.legend!.show).length;
    const offCount = panelsWithLegends.length - onCount;
    const panelLegendsOn = onCount >= offCount;

    for (const panel of panelsWithLegends) {
      panel.legend!.show = !panelLegendsOn;
      panel.render();
    }
  }

  getVariables = () => this.getVariablesFromState(this.uid);

  canEditAnnotations(dashboardId: number) {
    let canEdit = true;

    // if RBAC is enabled there are additional conditions to check
    if (contextSrv.accessControlEnabled()) {
      if (dashboardId === 0) {
        canEdit = !!this.meta.annotationsPermissions?.organization.canEdit;
      } else {
        canEdit = !!this.meta.annotationsPermissions?.dashboard.canEdit;
      }
    }
    return this.canEditDashboard() && canEdit;
  }

  canAddAnnotations() {
    let canAdd = true;

    // if RBAC is enabled there are additional conditions to check
    if (contextSrv.accessControlEnabled()) {
      canAdd = !!this.meta.annotationsPermissions?.dashboard.canAdd;
    }

    return this.canEditDashboard() && canAdd;
  }

  canEditDashboard() {
    return this.meta.canEdit || this.meta.canMakeEditable;
  }

  shouldUpdateDashboardPanelFromJSON(updatedPanel: PanelModel, panel: PanelModel) {
    const shouldUpdateGridPositionLayout = !isEqual(updatedPanel?.gridPos, panel?.gridPos);
    if (shouldUpdateGridPositionLayout) {
      this.events.publish(new DashboardPanelsChangedEvent());
    }
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

  private hasVariablesChanged(originalVariables: any[], currentVariables: any[]): boolean {
    if (originalVariables.length !== currentVariables.length) {
      return false;
    }

    const updated = map(currentVariables, (variable: any) => ({
      name: variable.name,
      type: variable.type,
      current: cloneDeep(variable.current),
      filters: cloneDeep(variable.filters),
    }));

    return !isEqual(updated, originalVariables);
  }

  private cloneVariablesFrom(variables: any[]): any[] {
    return variables.map((variable) => ({
      name: variable.name,
      type: variable.type,
      current: cloneDeep(variable.current),
      filters: cloneDeep(variable.filters),
    }));
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
}
