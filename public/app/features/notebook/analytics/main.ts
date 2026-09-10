import { defineFeatureEvents } from '@grafana/runtime/unstable';

import { canEditNotebooks } from '../permissions';
import { type NotebookScene } from '../scene/NotebookScene';
import { isNotebookEditUrl } from '../urls';

import { readNotebookShape } from './shape';
import {
  type NotebookAutosaveFailedProperties,
  type NotebookAutosaveFailedReason,
  type NotebookCellAddedProperties,
  type NotebookCreatedProperties,
  type NotebookDeletedProperties,
  type NotebookDeleteSource,
  type NotebookEditSessionEndReason,
  type NotebookEditSessionEndedProperties,
  type NotebookEditSessionSource,
  type NotebookEditSessionStartedProperties,
  type NotebookEntryPoint,
  type NotebookLoadedProperties,
  type NotebookNewStartedProperties,
} from './types';

/** @owner sharing-squad */
const createNotebookEvent = defineFeatureEvents('grafana', 'notebook');

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

/** Fired once a delete has actually landed, from either the list row menu or the notebook's own toolbar. */
const createDeletedEvent = createNotebookEvent<NotebookDeletedProperties>('deleted');

/**
 * Fired when a panel is added to a notebook that is not open, from Explore or a dashboard. For a cell
 * added inside an editing session, the session keeps a count on `edit_session_ended` instead.
 */
const createCellAddedEvent = createNotebookEvent<NotebookCellAddedProperties>('cell_added');

/** Fired on each autosave error, never on success. A save still in flight has no outcome to report. */
const createAutosaveFailedEvent = createNotebookEvent<NotebookAutosaveFailedProperties>('autosave_failed');

/**
 * Every notebook event, so a call site reads as analytics rather than as a stray helper. The wrappers
 * turn a scene into what each event sends, here and once, instead of at every place that fires one.
 */
export const NotebookAnalytics = {
  loaded(scene: NotebookScene, wasCached: boolean): void {
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

  created(notebookUid: string, source: NotebookEntryPoint, cellCount: number): void {
    createCreatedEvent({ notebookUid, source, cellCount });
  },

  deleted(notebookUid: string, source: NotebookDeleteSource): void {
    createDeletedEvent({ notebookUid, source });
  },

  autosaveFailed(notebookUid: string, reason: NotebookAutosaveFailedReason, attempt: number): void {
    createAutosaveFailedEvent({ notebookUid, reason, attempt });
  },

  cellAdded(notebookUid: string, source: NotebookEntryPoint, position: number): void {
    createCellAddedEvent({ notebookUid, source, position });
  },
};
