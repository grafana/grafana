import { stringToJsRegex } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';
import { type ThunkResult } from 'app/types/store';

import { validateVariableSelectionState } from '../state/actions';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { getVariable } from '../state/selectors';
import { type KeyedVariableIdentifier } from '../state/types';
import { toVariablePayload } from '../utils';

import { createDataSourceOptions } from './reducer';

export interface DataSourceVariableActionDependencies {
  getDataSourceInstanceList: typeof getDataSourceInstanceList;
}

export const updateDataSourceVariableOptions =
  (
    identifier: KeyedVariableIdentifier,
    dependencies: DataSourceVariableActionDependencies = { getDataSourceInstanceList }
  ): ThunkResult<void> =>
  async (dispatch, getState) => {
    const { rootStateKey } = identifier;
    const sources = await dependencies.getDataSourceInstanceList({ metrics: true, variables: false });
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
    await dispatch(validateVariableSelectionState(identifier));
  };
