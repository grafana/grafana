import { __awaiter } from "tslib";
import { Subscription } from 'rxjs';
import { getDataSourceSrv, toDataQueryError } from '@grafana/runtime';
import { getVariableQueryEditor } from '../editor/getVariableQueryEditor';
import { addVariableEditorError, changeVariableEditorExtended, removeVariableEditorError } from '../editor/reducer';
import { getQueryVariableEditorState } from '../editor/selectors';
import { updateOptions } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable, getVariablesState } from '../state/selectors';
import { changeVariableProp } from '../state/sharedReducer';
import { hasOngoingTransaction, toKeyedVariableIdentifier, toVariablePayload } from '../utils';
import { getVariableQueryRunner } from './VariableQueryRunner';
import { variableQueryObserver } from './variableQueryObserver';
export const updateQueryVariableOptions = (identifier, searchFilter) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            const { rootStateKey } = identifier;
            if (!hasOngoingTransaction(rootStateKey, getState())) {
                // we might have cancelled a batch so then variable state is removed
                return;
            }
            const variableInState = getVariable(identifier, getState());
            if (variableInState.type !== 'query') {
                return;
            }
            if (getVariablesState(rootStateKey, getState()).editor.id === variableInState.id) {
                dispatch(toKeyedAction(rootStateKey, removeVariableEditorError({ errorProp: 'update' })));
            }
            const datasource = yield getDataSourceSrv().get((_a = variableInState.datasource) !== null && _a !== void 0 ? _a : '');
            // We need to await the result from variableQueryRunner before moving on otherwise variables dependent on this
            // variable will have the wrong current value as input
            yield new Promise((resolve, reject) => {
                const subscription = new Subscription();
                const observer = variableQueryObserver(resolve, reject, subscription);
                const responseSubscription = getVariableQueryRunner().getResponse(identifier).subscribe(observer);
                subscription.add(responseSubscription);
                getVariableQueryRunner().queueRequest({ identifier, datasource, searchFilter });
            });
        }
        catch (err) {
            if (err instanceof Error) {
                const error = toDataQueryError(err);
                const { rootStateKey } = identifier;
                if (getVariablesState(rootStateKey, getState()).editor.id === identifier.id) {
                    dispatch(toKeyedAction(rootStateKey, addVariableEditorError({ errorProp: 'update', errorText: error.message })));
                }
                throw error;
            }
        }
    });
};
export const initQueryVariableEditor = (identifier) => (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
    const variable = getVariable(identifier, getState());
    if (variable.type !== 'query') {
        return;
    }
    yield dispatch(changeQueryVariableDataSource(toKeyedVariableIdentifier(variable), variable.datasource));
});
export const changeQueryVariableDataSource = (identifier, name) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const { rootStateKey } = identifier;
            const { editor } = getVariablesState(rootStateKey, getState());
            const extendedEditorState = getQueryVariableEditorState(editor);
            const previousDatasource = extendedEditorState === null || extendedEditorState === void 0 ? void 0 : extendedEditorState.dataSource;
            const dataSource = yield getDataSourceSrv().get(name !== null && name !== void 0 ? name : '');
            if (previousDatasource && previousDatasource.type !== (dataSource === null || dataSource === void 0 ? void 0 : dataSource.type)) {
                dispatch(toKeyedAction(rootStateKey, changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: '' }))));
            }
            const VariableQueryEditor = yield getVariableQueryEditor(dataSource);
            dispatch(toKeyedAction(rootStateKey, changeVariableEditorExtended({
                dataSource,
                VariableQueryEditor,
            })));
        }
        catch (err) {
            console.error(err);
        }
    });
};
export const changeQueryVariableQuery = (identifier, query, definition) => (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
    const { rootStateKey } = identifier;
    const variableInState = getVariable(identifier, getState());
    if (variableInState.type !== 'query') {
        return;
    }
    if (hasSelfReferencingQuery(variableInState.name, query)) {
        const errorText = 'Query cannot contain a reference to itself. Variable: $' + variableInState.name;
        dispatch(toKeyedAction(rootStateKey, addVariableEditorError({ errorProp: 'query', errorText })));
        return;
    }
    dispatch(toKeyedAction(rootStateKey, removeVariableEditorError({ errorProp: 'query' })));
    dispatch(toKeyedAction(rootStateKey, changeVariableProp(toVariablePayload(identifier, { propName: 'query', propValue: query }))));
    if (definition !== undefined) {
        dispatch(toKeyedAction(rootStateKey, changeVariableProp(toVariablePayload(identifier, { propName: 'definition', propValue: definition }))));
    }
    else if (typeof query === 'string') {
        dispatch(toKeyedAction(rootStateKey, changeVariableProp(toVariablePayload(identifier, { propName: 'definition', propValue: query }))));
    }
    yield dispatch(updateOptions(identifier));
});
export function hasSelfReferencingQuery(name, query) {
    if (typeof query === 'string' && query.match(new RegExp('\\$' + name + '(/| |$)'))) {
        return true;
    }
    const flattened = flattenQuery(query);
    for (let prop in flattened) {
        if (flattened.hasOwnProperty(prop)) {
            const value = flattened[prop];
            if (typeof value === 'string' && value.match(new RegExp('\\$' + name + '(/| |$)'))) {
                return true;
            }
        }
    }
    return false;
}
/*
 * Function that takes any object and flattens all props into one level deep object
 * */
export function flattenQuery(query) {
    if (typeof query !== 'object' || query === null) {
        return { query };
    }
    const keys = Object.keys(query);
    const flattened = keys.reduce((all, key) => {
        const value = query[key];
        if (typeof value !== 'object' || value === null) {
            all[key] = value;
            return all;
        }
        const result = flattenQuery(value);
        for (let childProp in result) {
            if (result.hasOwnProperty(childProp)) {
                all[`${key}_${childProp}`] = result[childProp];
            }
        }
        return all;
    }, {});
    return flattened;
}
//# sourceMappingURL=actions.js.map