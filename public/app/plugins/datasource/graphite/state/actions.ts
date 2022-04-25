import { createAction } from '@reduxjs/toolkit';

import { TimeRange } from '@grafana/data';

import { FuncInstance } from '../gfunc';
import { GraphiteQuery, GraphiteQueryEditorDependencies, GraphiteSegment, GraphiteTag } from '../types';

/**
 * List of possible actions changing the state of QueryEditor
 */

const init = createAction<GraphiteQueryEditorDependencies>('init');

/**
 * Synchronise editor dependencies with internal state.
 */
const timeRangeChanged = createAction<TimeRange | undefined>('time-range-changed');
const queriesChanged = createAction<GraphiteQuery[] | undefined>('queries-changed');
const queryChanged = createAction<GraphiteQuery>('query-changed');

// Metrics & Tags
const segmentValueChanged = createAction<{ segment: GraphiteSegment | string; index: number }>('segment-value-changed');

// Tags
const addNewTag = createAction<{ segment: GraphiteSegment }>('add-new-tag');
const tagChanged = createAction<{ tag: GraphiteTag; index: number }>('tag-changed');
const unpause = createAction('unpause');

// Functions
const addFunction = createAction<{ name: string }>('add-function');
const removeFunction = createAction<{ func: FuncInstance }>('remove-function');
const moveFunction = createAction<{ func: FuncInstance; offset: number }>('move-function');
const updateFunctionParam = createAction<{ func: FuncInstance; index: number; value: string }>('change-function-param');

// Text editor
const updateQuery = createAction<{ query: string }>('update-query');
const runQuery = createAction('run-current-query');
const toggleEditorMode = createAction('toggle-editor');

export const actions = {
  init,
  timeRangeChanged,
  queriesChanged,
  queryChanged,
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
