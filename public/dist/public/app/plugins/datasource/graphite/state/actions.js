import { createAction } from '@reduxjs/toolkit';
/**
 * List of possible actions changing the state of QueryEditor
 */
var init = createAction('init');
/**
 * Synchronise editor dependencies with internal state.
 */
var timeRangeChanged = createAction('time-range-changed');
var queriesChanged = createAction('queries-changed');
var queryChanged = createAction('query-changed');
// Metrics & Tags
var segmentValueChanged = createAction('segment-value-changed');
// Tags
var addNewTag = createAction('add-new-tag');
var tagChanged = createAction('tag-changed');
var unpause = createAction('unpause');
// Functions
var addFunction = createAction('add-function');
var removeFunction = createAction('remove-function');
var moveFunction = createAction('move-function');
var updateFunctionParam = createAction('change-function-param');
// Text editor
var updateQuery = createAction('update-query');
var runQuery = createAction('run-current-query');
var toggleEditorMode = createAction('toggle-editor');
export var actions = {
    init: init,
    timeRangeChanged: timeRangeChanged,
    queriesChanged: queriesChanged,
    queryChanged: queryChanged,
    segmentValueChanged: segmentValueChanged,
    tagChanged: tagChanged,
    addNewTag: addNewTag,
    unpause: unpause,
    addFunction: addFunction,
    removeFunction: removeFunction,
    moveFunction: moveFunction,
    updateFunctionParam: updateFunctionParam,
    updateQuery: updateQuery,
    runQuery: runQuery,
    toggleEditorMode: toggleEditorMode,
};
//# sourceMappingURL=actions.js.map