import { __awaiter } from "tslib";
import { rangeUtil } from '@grafana/data';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { getTemplateSrv } from '../../templating/template_srv';
import { validateVariableSelectionState } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable } from '../state/selectors';
import { toVariablePayload } from '../utils';
import { createIntervalOptions } from './reducer';
export const updateIntervalVariableOptions = (identifier) => (dispatch) => __awaiter(void 0, void 0, void 0, function* () {
    const { rootStateKey } = identifier;
    yield dispatch(toKeyedAction(rootStateKey, createIntervalOptions(toVariablePayload(identifier))));
    yield dispatch(updateAutoValue(identifier));
    yield dispatch(validateVariableSelectionState(identifier));
});
export const updateAutoValue = (identifier, dependencies = {
    calculateInterval: rangeUtil.calculateInterval,
    getTimeSrv: getTimeSrv,
    templateSrv: getTemplateSrv(),
}) => (dispatch, getState) => {
    const variableInState = getVariable(identifier, getState());
    if (variableInState.type !== 'interval') {
        return;
    }
    if (variableInState.auto) {
        const res = dependencies.calculateInterval(dependencies.getTimeSrv().timeRange(), variableInState.auto_count, variableInState.auto_min);
        dependencies.templateSrv.setGrafanaVariable('$__auto_interval_' + variableInState.name, res.interval);
        // for backward compatibility, to be removed eventually
        dependencies.templateSrv.setGrafanaVariable('$__auto_interval', res.interval);
    }
};
//# sourceMappingURL=actions.js.map