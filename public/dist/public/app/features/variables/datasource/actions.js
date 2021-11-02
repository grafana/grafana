import { __awaiter, __generator } from "tslib";
import { chain } from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';
import { stringToJsRegex } from '@grafana/data';
import { toVariablePayload } from '../state/types';
import { createDataSourceOptions } from './reducer';
import { validateVariableSelectionState } from '../state/actions';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getVariable } from '../state/selectors';
import { changeVariableEditorExtended } from '../editor/reducer';
export var updateDataSourceVariableOptions = function (identifier, dependencies) {
    if (dependencies === void 0) { dependencies = { getDatasourceSrv: getDatasourceSrv }; }
    return function (dispatch, getState) { return __awaiter(void 0, void 0, void 0, function () {
        var sources, variableInState, regex;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sources = dependencies.getDatasourceSrv().getList({ metrics: true, variables: false });
                    variableInState = getVariable(identifier.id, getState());
                    if (variableInState.regex) {
                        regex = getTemplateSrv().replace(variableInState.regex, undefined, 'regex');
                        regex = stringToJsRegex(regex);
                    }
                    dispatch(createDataSourceOptions(toVariablePayload(identifier, { sources: sources, regex: regex })));
                    return [4 /*yield*/, dispatch(validateVariableSelectionState(identifier))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); };
};
export var initDataSourceVariableEditor = function (dependencies) {
    if (dependencies === void 0) { dependencies = { getDatasourceSrv: getDatasourceSrv }; }
    return function (dispatch) {
        var dataSources = dependencies.getDatasourceSrv().getList({ metrics: true, variables: true });
        var dataSourceTypes = chain(dataSources)
            .uniqBy('meta.id')
            .map(function (ds) {
            return { text: ds.meta.name, value: ds.meta.id };
        })
            .value();
        dataSourceTypes.unshift({ text: '', value: '' });
        dispatch(changeVariableEditorExtended({
            propName: 'dataSourceTypes',
            propValue: dataSourceTypes,
        }));
    };
};
//# sourceMappingURL=actions.js.map