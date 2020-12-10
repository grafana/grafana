import { rangeUtil } from '@grafana/data';

import { toVariablePayload, VariableIdentifier } from '../state/types';
import { ThunkResult } from '../../../types';
import { createIntervalOptions } from './reducer';
import { validateVariableSelectionState } from '../state/actions';
import { getVariable } from '../state/selectors';
import { IntervalVariableModel } from '../types';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { getTemplateSrv, TemplateSrv } from '../../templating/template_srv';

export const updateIntervalVariableOptions = (identifier: VariableIdentifier): ThunkResult<void> => async dispatch => {
  await dispatch(createIntervalOptions(toVariablePayload(identifier)));
  await dispatch(updateAutoValue(identifier));
  await dispatch(validateVariableSelectionState(identifier));
};

export interface UpdateAutoValueDependencies {
  calculateInterval: typeof rangeUtil.calculateInterval;
  getTimeSrv: typeof getTimeSrv;
  templateSrv: TemplateSrv;
}

export const updateAutoValue = (
  identifier: VariableIdentifier,
  dependencies: UpdateAutoValueDependencies = {
    calculateInterval: rangeUtil.calculateInterval,
    getTimeSrv: getTimeSrv,
    templateSrv: getTemplateSrv(),
  }
): ThunkResult<void> => (dispatch, getState) => {
  const variableInState = getVariable<IntervalVariableModel>(identifier.id, getState());
  if (variableInState.auto) {
    const res = dependencies.calculateInterval(
      dependencies.getTimeSrv().timeRange(),
      variableInState.auto_count,
      variableInState.auto_min
    );
    dependencies.templateSrv.setGrafanaVariable('$__auto_interval_' + variableInState.name, res.interval);
    // for backward compatibility, to be removed eventually
    dependencies.templateSrv.setGrafanaVariable('$__auto_interval', res.interval);
  }
};
