import { createAction } from '@reduxjs/toolkit';
/**
 * List of possible actions changing the state of QueryEditor
 */
const init = createAction('init');
/**
 * Synchronise editor dependencies with internal state.
 */
const timeRangeChanged = createAction('time-range-changed');
const queriesChanged = createAction('queries-changed');
const queryChanged = createAction('query-changed');
// Metrics & Tags
const segmentValueChanged = createAction('segment-value-changed');
// Tags
const addNewTag = createAction('add-new-tag');
const tagChanged = createAction('tag-changed');
const unpause = createAction('unpause');
// Functions
const addFunction = createAction('add-function');
const removeFunction = createAction('remove-function');
const moveFunction = createAction('move-function');
const updateFunctionParam = createAction('change-function-param');
// Text editor
const updateQuery = createAction('update-query');
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
//# sourceMappingURL=actions.js.map