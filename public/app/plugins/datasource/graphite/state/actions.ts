import { GraphiteQueryEditorAngularDependencies, GraphiteSegment, GraphiteTag } from '../types';
import { createAction } from '@reduxjs/toolkit';
import { FuncInstance } from '../gfunc';

/**
 * List of possible actions changing the state of QueryEditor
 */

/**
 * This is used only during the transition to react. It will be removed after migrating all components.
 */
const init = createAction<GraphiteQueryEditorAngularDependencies>('init');

// Metrics & Tags
const segmentValueChanged = createAction<{ segment: GraphiteSegment; index: number }>('segment-value-changed');

// Tags
const addNewTag = createAction<{ segment: GraphiteSegment }>('add-new-tag');
const tagChanged = createAction<{ tag: GraphiteTag; index: number }>('tag-changed');
const unpause = createAction('unpause');

// Functions
const addFunction = createAction<{ name: string }>('add-function');
const removeFunction = createAction<{ func: FuncInstance }>('remove-function');
const moveFunction = createAction<{ func: FuncInstance; offset: number }>('move-function');
// TODO: at the moment parameters are modified directly, new value of the param will be passed in the action
const updateFunctionParam = createAction<{ func: FuncInstance }>('update-function-param');

// Text editor
const updateQuery = createAction<{ query: string }>('update-query');
const runQuery = createAction('run-current-query');
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
  updateFunctionParam,
  updateQuery,
  runQuery,
  toggleEditorMode,
};
