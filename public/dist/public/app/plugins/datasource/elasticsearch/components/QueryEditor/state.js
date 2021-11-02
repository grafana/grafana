import { createAction } from '@reduxjs/toolkit';
/**
 * When the `initQuery` Action is dispatched, the query gets populated with default values where values are not present.
 * This means it won't override any existing value in place, but just ensure the query is in a "runnable" state.
 */
export var initQuery = createAction('init');
export var changeQuery = createAction('change_query');
export var changeAliasPattern = createAction('change_alias_pattern');
export var queryReducer = function (prevQuery, action) {
    if (changeQuery.match(action)) {
        return action.payload;
    }
    if (initQuery.match(action)) {
        return prevQuery || '';
    }
    return prevQuery;
};
export var aliasPatternReducer = function (prevAliasPattern, action) {
    if (changeAliasPattern.match(action)) {
        return action.payload;
    }
    if (initQuery.match(action)) {
        return prevAliasPattern || '';
    }
    return prevAliasPattern;
};
//# sourceMappingURL=state.js.map