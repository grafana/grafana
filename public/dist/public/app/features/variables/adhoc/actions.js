import { __awaiter } from "tslib";
import { cloneDeep } from 'lodash';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { changeVariableEditorExtended } from '../editor/reducer';
import { isAdHoc } from '../guard';
import { variableUpdated } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getLastKey, getNewVariableIndex, getVariable, getVariablesState } from '../state/selectors';
import { addVariable, changeVariableProp } from '../state/sharedReducer';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';
import { filterAdded, filterRemoved, filtersRestored, filterUpdated, initialAdHocVariableModelState, } from './reducer';
const filterTableName = 'Filters';
export const applyFilterFromTable = (options) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        let variable = getVariableByOptions(options, getState());
        if (!variable) {
            dispatch(createAdHocVariable(options));
            variable = getVariableByOptions(options, getState());
            if (!variable) {
                return;
            }
        }
        const index = variable.filters.findIndex((f) => f.key === options.key && f.value === options.value);
        if (index === -1) {
            const { value, key, operator } = options;
            const filter = { value, key, operator };
            return yield dispatch(addFilter(toKeyedVariableIdentifier(variable), filter));
        }
        const filter = Object.assign(Object.assign({}, variable.filters[index]), { operator: options.operator });
        return yield dispatch(changeFilter(toKeyedVariableIdentifier(variable), { index, filter }));
    });
};
export const changeFilter = (identifier, update) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const variable = getVariable(identifier, getState());
        dispatch(toKeyedAction(identifier.rootStateKey, filterUpdated(toVariablePayload(variable, update))));
        yield dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
    });
};
export const removeFilter = (identifier, index) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const variable = getVariable(identifier, getState());
        dispatch(toKeyedAction(identifier.rootStateKey, filterRemoved(toVariablePayload(variable, index))));
        yield dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
    });
};
export const addFilter = (identifier, filter) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const variable = getVariable(identifier, getState());
        dispatch(toKeyedAction(identifier.rootStateKey, filterAdded(toVariablePayload(variable, filter))));
        yield dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
    });
};
export const setFiltersFromUrl = (identifier, filters) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const variable = getVariable(identifier, getState());
        dispatch(toKeyedAction(identifier.rootStateKey, filtersRestored(toVariablePayload(variable, filters))));
        yield dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
    });
};
export const changeVariableDatasource = (identifier, datasource) => {
    return (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
        const variable = getVariable(identifier, getState());
        dispatch(toKeyedAction(identifier.rootStateKey, changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource }))));
        const ds = yield getDatasourceSrv().get(datasource);
        // TS TODO: ds is not typed to be optional - is this check unnecessary or is the type incorrect?
        const message = (ds === null || ds === void 0 ? void 0 : ds.getTagKeys)
            ? 'Ad hoc filters are applied automatically to all queries that target this data source'
            : 'This data source does not support ad hoc filters yet.';
        dispatch(toKeyedAction(identifier.rootStateKey, changeVariableEditorExtended({
            infoText: message,
        })));
    });
};
const createAdHocVariable = (options) => {
    return (dispatch, getState) => {
        const key = getLastKey(getState());
        const model = Object.assign(Object.assign({}, cloneDeep(initialAdHocVariableModelState)), { datasource: options.datasource, name: filterTableName, id: filterTableName, rootStateKey: key });
        const global = false;
        const index = getNewVariableIndex(key, getState());
        const identifier = { type: 'adhoc', id: model.id, rootStateKey: key };
        dispatch(toKeyedAction(key, addVariable(toVariablePayload(identifier, { global, model, index }))));
    };
};
const getVariableByOptions = (options, state) => {
    const key = getLastKey(state);
    const templatingState = getVariablesState(key, state);
    return Object.values(templatingState.variables).find((v) => { var _a; return isAdHoc(v) && ((_a = v.datasource) === null || _a === void 0 ? void 0 : _a.uid) === options.datasource.uid; });
};
//# sourceMappingURL=actions.js.map