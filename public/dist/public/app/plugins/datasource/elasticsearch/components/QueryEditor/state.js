import { createAction } from '@reduxjs/toolkit';
/**
 * When the `initQuery` Action is dispatched, the query gets populated with default values where values are not present.
 * This means it won't override any existing value in place, but just ensure the query is in a "runnable" state.
 */
export const initQuery = createAction('init');
export const changeQuery = createAction('change_query');
export const changeAliasPattern = createAction('change_alias_pattern');
export const queryReducer = (prevQuery, action) => {
    if (changeQuery.match(action)) {
        return action.payload;
    }
    if (initQuery.match(action)) {
        return prevQuery || '';
    }
    return prevQuery;
};
export const aliasPatternReducer = (prevAliasPattern, action) => {
    if (changeAliasPattern.match(action)) {
        return action.payload;
    }
    if (initQuery.match(action)) {
        return prevAliasPattern || '';
    }
    return prevAliasPattern;
};
//# sourceMappingURL=state.js.map