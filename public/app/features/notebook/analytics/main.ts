import { defineFeatureEvents } from '@grafana/runtime/unstable';

import { canEditNotebooks } from '../permissions';
import { type NotebookScene } from '../scene/NotebookScene';
import { isNotebookEditUrl } from '../urls';

import { readNotebookShape } from './shape';
import {
  type NotebookCreatedProperties,
  type NotebookDeletedProperties,
  type NotebookDeleteSource,
  type NotebookEntryPoint,
  type NotebookLoadedProperties,
  type NotebookNewStartedProperties,
} from './types';

/** @owner sharing-squad */
export const createNotebookEvent = defineFeatureEvents('grafana', 'notebook');

/** Fired once per navigation that actually renders a notebook: a fresh fetch or a cache hit. */
const createLoadedEvent = createNotebookEvent<NotebookLoadedProperties>('loaded');

/** Fired when the blank notebook route opens, so nothing exists yet: pairs with `created` to give the abandonment rate. */
const createNewStartedEvent = createNotebookEvent<NotebookNewStartedProperties>('new_started');

/** Fired the moment a notebook first exists: autosave's first write, or the add-panel modal's create route. */
const createCreatedEvent = createNotebookEvent<NotebookCreatedProperties>('created');

/** Fired once a delete has actually landed, from either the list row menu or the notebook's own toolbar. */
const createDeletedEvent = createNotebookEvent<NotebookDeletedProperties>('deleted');

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

  created(notebookUid: string, source: NotebookEntryPoint, cellCount: number): void {
    createCreatedEvent({ notebookUid, source, cellCount });
  },

  deleted(notebookUid: string, source: NotebookDeleteSource): void {
    createDeletedEvent({ notebookUid, source });
  },
};
