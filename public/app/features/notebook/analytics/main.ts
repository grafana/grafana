import { defineFeatureEvents } from '@grafana/runtime/unstable';

import { type NotebookScene } from '../scene/NotebookScene';

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
 * Every notebook event, so a call site reads as analytics rather than as a stray helper. The
 * wrappers exist because the events take a snake_case payload and their call sites hold a scene, so
 * the mapping lives here once instead of at each place that fires one.
 */
export const notebookAnalytics = {
  loaded(scene: NotebookScene, wasCached: boolean): void {
    const shape = readNotebookShape(scene);

    createLoadedEvent({
      // Both call sites only reach this with a scene that already has a uid, so the fallback here is
      // defensive, not expected to trigger.
      notebook_uid: scene.state.uid ?? '',
      cell_count: shape.cellCount,
      cells_by_type: shape.cellsByType,
      panel_count: shape.panelCount,
      datasource_types: shape.datasourceTypes,
      assistant_cell_count: shape.assistantCellCount,
      mode: scene.state.isEditing ? 'edit' : 'view',
      was_cached: wasCached,
      meaningful_cell_count: shape.meaningfulCellCount,
      text_cell_count: shape.textCellCount,
      code_cell_count: shape.codeCellCount,
      configured_panel_count: shape.configuredPanelCount,
      datasource_count: shape.datasourceCount,
    });
  },

  newStarted(source: NotebookEntryPoint): void {
    createNewStartedEvent({ source });
  },

  created(notebookUid: string, source: NotebookEntryPoint, cellCount: number): void {
    createCreatedEvent({ notebook_uid: notebookUid, source, cell_count: cellCount });
  },

  deleted(notebookUid: string, source: NotebookDeleteSource): void {
    createDeletedEvent({ notebook_uid: notebookUid, source });
  },
};
