import { defineFeatureEvents } from '@grafana/runtime/unstable';

import { canEditNotebooks } from '../permissions';
import { type NotebookScene } from '../scene/NotebookScene';
import { type NotebookBlockType } from '../scene/layout-notebook/edit/NotebookBlockTypeMenu';
import { type PanelElement } from '../types';
import { isNotebookEditUrl } from '../urls';

import { type NotebookSourceApp } from './captureSource';
import { readAddedPanelShape, readNotebookShape } from './shape';
import {
  NOTEBOOK_ADDED_CELL_TYPE,
  NOTEBOOK_ADD_TARGET,
  type NotebookAddFailedProperties,
  type NotebookAddFailedReason,
  type NotebookAddOpenedProperties,
  type NotebookAddTarget,
  type NotebookAutosaveConflictResolution,
  type NotebookAutosaveConflictResolvedProperties,
  type NotebookAutosaveFailedProperties,
  type NotebookAutosaveFailedReason,
  type NotebookAutosaveRetriedProperties,
  type NotebookBlockInsertedProperties,
  type NotebookBlockInsertVia,
  type NotebookCellAddedFromAddToNotebookProperties,
  type NotebookCreatedProperties,
  type NotebookDeletedProperties,
  type NotebookDeleteSource,
  type NotebookEditSessionEndReason,
  type NotebookEditSessionEndedProperties,
  type NotebookEditSessionSource,
  type NotebookEditSessionStartedProperties,
  type NotebookEntryPoint,
  type NotebookExportedProperties,
  type NotebookExportDestination,
  type NotebookExportSource,
  type NotebookIncidentAction,
  type NotebookIncidentActionClickedProperties,
  type NotebookIncidentActionCompletedProperties,
  type NotebookLeavePromptReason,
  type NotebookLeavePromptResolution,
  type NotebookLeavePromptResolvedProperties,
  type NotebookLinkCopiedProperties,
  type NotebookLinkCopySource,
  type NotebookListFilteredProperties,
  type NotebookListFilterState,
  type NotebookListFilterType,
  type NotebookLoadedProperties,
  type NotebookLoadSource,
  type NotebookNewStartedProperties,
  type NotebookViewOnlyChangesResolution,
  type NotebookViewOnlyChangesResolvedProperties,
} from './types';

/** @owner sharing-squad */
const createNotebookEvent = defineFeatureEvents('grafana', 'notebook', {
  /** Version of the event schema, used to handle breaking changes in the properties contract. */
  schema_version: 1,
});

/** Fired once per navigation that actually renders a notebook: a fresh fetch or a cache hit. */
const createLoadedEvent = createNotebookEvent<NotebookLoadedProperties>('loaded');

/** Fired when the blank notebook route opens, so nothing exists yet: pairs with `created` to give the abandonment rate. */
const createNewStartedEvent = createNotebookEvent<NotebookNewStartedProperties>('new_started');

/** Fired when edit mode begins. Pairs with `edit_session_ended` for the length and the totals. */
const createEditSessionStartedEvent = createNotebookEvent<NotebookEditSessionStartedProperties>('edit_session_started');

/**
 * Fired when edit mode ends. Carries how long the session ran, how much was edited, and the shape
 * the notebook was left in. Save outcomes are not here: they are reported by `autosave_failed` at
 * the moment they happen, which this event cannot do because it fires while a save is still open.
 */
const createEditSessionEndedEvent = createNotebookEvent<NotebookEditSessionEndedProperties>('edit_session_ended');

/** Fired the moment a notebook first exists: autosave's first write, or the add-panel modal's create route. */
const createCreatedEvent = createNotebookEvent<NotebookCreatedProperties>('created');
const createAddOpenedEvent = createNotebookEvent<NotebookAddOpenedProperties>('add_to_notebook_opened');

/** Fired once a delete has actually landed, from either the list row menu or the notebook's own toolbar. */
const createDeletedEvent = createNotebookEvent<NotebookDeletedProperties>('deleted');

/**
 * Fired for each cell added through "Add to notebook", from Explore, a dashboard or a plugin: a panel,
 * or the markdown a chat answer brings with it. A cell added from inside the notebook is counted on
 * `edit_session_ended` instead. An add into a notebook that is open lands in both.
 */
const createCellAddedFromAddToNotebookEvent = createNotebookEvent<NotebookCellAddedFromAddToNotebookProperties>(
  'cell_added_from_add_to_notebook'
);

/** Fired on each autosave error, never on success. A save still in flight has no outcome to report. */
const createAutosaveFailedEvent = createNotebookEvent<NotebookAutosaveFailedProperties>('autosave_failed');

/** Fired once the user answers the save-conflict prompt, whichever way: this is the choice, not the conflict. */
const createAutosaveConflictResolvedEvent =
  createNotebookEvent<NotebookAutosaveConflictResolvedProperties>('autosave_conflict_resolved');

/** Fired once an export action actually completed: a copy that landed, or a download. */
const createExportedEvent = createNotebookEvent<NotebookExportedProperties>('exported');

/** Fired once a copy-link click actually put the link on the clipboard. */
const createLinkCopiedEvent = createNotebookEvent<NotebookLinkCopiedProperties>('link_copied');

/** Fired when an IRM action is picked from the notebook's menu, as its form opens. */
const createIncidentActionClickedEvent =
  createNotebookEvent<NotebookIncidentActionClickedProperties>('incident_action_clicked');

/** Fired once per committed filter change on the notebooks list, as the change commits. */
const createListFilteredEvent = createNotebookEvent<NotebookListFilteredProperties>('list_filtered');

/**
 * Fired when an "Add to notebook" submit fails. Nothing was added and nothing was created.
 *
 * The successes are `cell_added_from_add_to_notebook` and `created`. `target` says which of the two
 * this attempt was aiming for.
 */
const createAddFailedEvent = createNotebookEvent<NotebookAddFailedProperties>('add_to_notebook_failed');

/** Fired when the user picks a block to insert, or duplicates one. Not for the empty block the editor keeps at the bottom, nor for Enter splitting a paragraph. */
const createBlockInsertedEvent = createNotebookEvent<NotebookBlockInsertedProperties>('block_inserted');

/** Fired once the user answers the prompt that asks before leaving a notebook autosave has not finished writing. */
const createLeavePromptResolvedEvent =
  createNotebookEvent<NotebookLeavePromptResolvedProperties>('leave_prompt_resolved');

/** Fired once the user answers the prompt about panel changes made while viewing, which edit mode asks before it starts. */
const createViewOnlyChangesResolvedEvent =
  createNotebookEvent<NotebookViewOnlyChangesResolvedProperties>('view_only_changes_resolved');

/** Fired when the user presses Retry on a failed save. */
const createAutosaveRetriedEvent = createNotebookEvent<NotebookAutosaveRetriedProperties>('autosave_retried');

/** Fired once an IRM action actually finished, as opposed to `incident_action_clicked`, which is the form opening. */
const createIncidentActionCompletedEvent =
  createNotebookEvent<NotebookIncidentActionCompletedProperties>('incident_action_completed');

/** The one panel an add or a create came with, so both events describe it the same way. */
interface AddedPanel {
  panel: PanelElement;
  /**
   * The caller passes this in. The dashboard inlines a loaded library panel on the way here, so the
   * element no longer says that it came from the library.
   */
  isLibraryPanel: boolean;
}

function addedPanelProperties({ panel, isLibraryPanel }: AddedPanel) {
  return { isLibraryPanel, ...readAddedPanelShape(panel) };
}

/**
 * Every notebook event, so a call site reads as analytics rather than as a stray helper. The wrappers
 * turn a scene into what each event sends, here and once, instead of at every place that fires one.
 */
export const NotebookAnalytics = {
  addToNotebookOpened(source: NotebookEntryPoint, sourceApp?: NotebookSourceApp): void {
    createAddOpenedEvent({ source, ...(sourceApp && { source_app: sourceApp }) });
  },
  loaded(scene: NotebookScene, wasCached: boolean, embedded: boolean, source: NotebookLoadSource): void {
    createLoadedEvent({
      // Both call sites only reach this with a scene that already has a uid, so the fallback here is
      // defensive, not expected to trigger.
      notebookUid: scene.state.uid ?? '',
      ...readNotebookShape(scene),
      // The url decides the mode, not the scene. This fires while the notebook still loads, and the
      // scene only picks the mode up when the page renders it inside UrlSyncContextProvider.
      // Permission counts too: the sync refuses `?edit=true` for a reader and clears the param.
      mode: isNotebookEditUrl() && canEditNotebooks() ? 'edit' : 'view',
      wasCached,
      embedded,
      source,
    });
  },

  newStarted(source: NotebookEntryPoint): void {
    createNewStartedEvent({ source });
  },

  editSessionStarted(notebookUid: string, source: NotebookEditSessionSource): void {
    createEditSessionStartedEvent({ notebookUid, source });
  },

  editSessionEnded(scene: NotebookScene, endReason: NotebookEditSessionEndReason): void {
    createEditSessionEndedEvent({
      notebookUid: scene.state.uid ?? '',
      // Reading the totals also resets them, so the next session starts from nothing.
      ...scene.editSession.end(),
      endReason,
      ...readNotebookShape(scene),
    });
  },

  /**
   * `lockTimeRange` is given by the add-panel modal and not by the blank notebook route, which sends
   * neither it nor `target`: only an add has a target to name.
   */
  created(
    notebookUid: string,
    source: NotebookEntryPoint,
    cellCount: number,
    addedPanel?: AddedPanel,
    lockTimeRange?: boolean,
    sourceApp?: NotebookSourceApp
  ): void {
    createCreatedEvent({
      notebookUid,
      source,
      ...(sourceApp && { source_app: sourceApp }),
      cellCount,
      ...(lockTimeRange === undefined ? {} : { target: NOTEBOOK_ADD_TARGET.NEW, lockTimeRange }),
      // The blank notebook route sends none of these. It creates from whatever cells exist by its
      // first save, not around one panel.
      ...(addedPanel && addedPanelProperties(addedPanel)),
    });
  },

  deleted(notebookUid: string, source: NotebookDeleteSource): void {
    createDeletedEvent({ notebookUid, source });
  },

  autosaveFailed(notebookUid: string, reason: NotebookAutosaveFailedReason, attempt: number): void {
    createAutosaveFailedEvent({ notebookUid, reason, attempt });
  },

  autosaveConflictResolved(notebookUid: string, resolution: NotebookAutosaveConflictResolution): void {
    createAutosaveConflictResolvedEvent({ notebookUid, resolution });
  },

  exported(notebookUid: string, destination: NotebookExportDestination, source: NotebookExportSource): void {
    createExportedEvent({ notebookUid, destination, source });
  },

  linkCopied(notebookUid: string, source: NotebookLinkCopySource): void {
    createLinkCopiedEvent({ notebookUid, source });
  },

  incidentActionClicked(notebookUid: string, action: NotebookIncidentAction): void {
    createIncidentActionClickedEvent({ notebookUid, action });
  },

  listFiltered(filterType: NotebookListFilterType, filters: NotebookListFilterState): void {
    createListFilteredEvent({ filterType, ...filters });
  },

  /** `addedPanel` is left out for a markdown cell, which has no panel to describe. */
  cellAddedFromAddToNotebook(
    notebookUid: string,
    source: NotebookEntryPoint,
    position: number,
    addedPanel: AddedPanel | undefined,
    lockTimeRange: boolean,
    sourceApp?: NotebookSourceApp
  ): void {
    createCellAddedFromAddToNotebookEvent({
      notebookUid,
      source,
      ...(sourceApp && { source_app: sourceApp }),
      position,
      target: NOTEBOOK_ADD_TARGET.EXISTING,
      lockTimeRange,
      cellType: addedPanel ? NOTEBOOK_ADDED_CELL_TYPE.PANEL : NOTEBOOK_ADDED_CELL_TYPE.MARKDOWN,
      ...(addedPanel && addedPanelProperties(addedPanel)),
    });
  },

  addToNotebookFailed(
    notebookUid: string,
    source: NotebookEntryPoint,
    target: NotebookAddTarget,
    reason: NotebookAddFailedReason,
    lockTimeRange: boolean,
    sourceApp?: NotebookSourceApp
  ): void {
    createAddFailedEvent({
      notebookUid,
      source,
      target,
      reason,
      lockTimeRange,
      ...(sourceApp && { source_app: sourceApp }),
    });
  },

  blockInserted(notebookUid: string, blockType: NotebookBlockType, via: NotebookBlockInsertVia): void {
    createBlockInsertedEvent({ notebookUid, blockType, via });
  },

  leavePromptResolved(
    notebookUid: string,
    reason: NotebookLeavePromptReason,
    resolution: NotebookLeavePromptResolution
  ): void {
    createLeavePromptResolvedEvent({ notebookUid, reason, resolution });
  },

  viewOnlyChangesResolved(
    notebookUid: string,
    resolution: NotebookViewOnlyChangesResolution,
    changedPanelCount: number
  ): void {
    createViewOnlyChangesResolvedEvent({ notebookUid, resolution, changedPanelCount });
  },

  autosaveRetried(notebookUid: string, attempt: number): void {
    createAutosaveRetriedEvent({ notebookUid, attempt });
  },

  incidentActionCompleted(notebookUid: string, action: NotebookIncidentAction): void {
    createIncidentActionCompletedEvent({ notebookUid, action });
  },
};
