import { GraphiteQueryEditorAngularDependencies, GraphiteSegment, GraphiteTag } from './types';
import { createAction } from '@reduxjs/toolkit';

/**
 * List of possible actions changing the state of QueryEditor
 */

/**
 * This is used only during the transition to react. It will be removed after migrating all components.
 */
const init = createAction<GraphiteQueryEditorAngularDependencies>('init');

const segmentValueChanged = createAction<{ segment: GraphiteSegment; index: number }>('segment-value-changed');

const tagChanged = createAction<{ tag: GraphiteTag; index: number }>('tag-changed');

const addNewTag = createAction<{ segment: GraphiteSegment }>('add-new-tag');

const unpause = createAction('unpause');

const addFunction = createAction<{ name: string }>('add-function');

const removeFunction = createAction<{ funcDef: object }>('remove-function');

const moveFunction = createAction<{ funcDef: object; offset: number }>('move-function');

const targetChanged = createAction('target-changed');

const toggleEditorMode = createAction('toggle-editor');

export const actions = {
  init,
  segmentValueChanged,
  tagChanged,
  addNewTag,
  unpause,
  addFunction,
  removeFunction,
  moveFunction,
  targetChanged,
  toggleEditorMode,
};
