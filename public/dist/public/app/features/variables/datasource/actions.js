import { __awaiter } from "tslib";
import { chain } from 'lodash';
import { stringToJsRegex } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { changeVariableEditorExtended } from '../editor/reducer';
import { validateVariableSelectionState } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable } from '../state/selectors';
import { toVariablePayload } from '../utils';
import { createDataSourceOptions } from './reducer';
export const updateDataSourceVariableOptions = (identifier, dependencies = { getDatasourceSrv: getDatasourceSrv }) => (dispatch, getState) => __awaiter(void 0, void 0, void 0, function* () {
    const { rootStateKey } = identifier;
    const sources = dependencies.getDatasourceSrv().getList({ metrics: true, variables: false });
    const variableInState = getVariable(identifier, getState());
    if (variableInState.type !== 'datasource') {
        return;
    }
    let regex;
    if (variableInState.regex) {
        regex = getTemplateSrv().replace(variableInState.regex, undefined, 'regex');
        regex = stringToJsRegex(regex);
    }
    dispatch(toKeyedAction(rootStateKey, createDataSourceOptions(toVariablePayload(identifier, { sources, regex }))));
    yield dispatch(validateVariableSelectionState(identifier));
});
export const initDataSourceVariableEditor = (key, dependencies = { getDatasourceSrv: getDatasourceSrv }) => (dispatch) => {
    const dataSources = dependencies.getDatasourceSrv().getList({ metrics: true, variables: true });
    const dataSourceTypes = chain(dataSources)
        .uniqBy('meta.id')
        .map((ds) => {
        return { text: ds.meta.name, value: ds.meta.id };
    })
        .value();
    dataSourceTypes.unshift({ text: '', value: '' });
    dispatch(toKeyedAction(key, changeVariableEditorExtended({ dataSourceTypes })));
};
//# sourceMappingURL=actions.js.map