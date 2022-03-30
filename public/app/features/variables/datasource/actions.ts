import { chain } from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';
import { stringToJsRegex } from '@grafana/data';

import { KeyedVariableIdentifier } from '../state/types';
import { ThunkResult } from '../../../types';
import { createDataSourceOptions } from './reducer';
import { validateVariableSelectionState } from '../state/actions';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getVariable } from '../state/selectors';
import { DataSourceVariableModel } from '../types';
import { changeVariableEditorExtended } from '../editor/reducer';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { toVariablePayload } from '../utils';

export interface DataSourceVariableActionDependencies {
  getDatasourceSrv: typeof getDatasourceSrv;
}

export const updateDataSourceVariableOptions =
  (
    identifier: KeyedVariableIdentifier,
    dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrv }
  ): ThunkResult<void> =>
  async (dispatch, getState) => {
    const { rootStateKey } = identifier;
    const sources = dependencies.getDatasourceSrv().getList({ metrics: true, variables: false });
    const variableInState = getVariable<DataSourceVariableModel>(identifier, getState());
    let regex;

    if (variableInState.regex) {
      regex = getTemplateSrv().replace(variableInState.regex, undefined, 'regex');
      regex = stringToJsRegex(regex);
    }

    dispatch(toKeyedAction(rootStateKey, createDataSourceOptions(toVariablePayload(identifier, { sources, regex }))));
    await dispatch(validateVariableSelectionState(identifier));
  };

export const initDataSourceVariableEditor =
  (
    key: string,
    dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrv }
  ): ThunkResult<void> =>
  (dispatch) => {
    const dataSources = dependencies.getDatasourceSrv().getList({ metrics: true, variables: true });
    const dataSourceTypes = chain(dataSources)
      .uniqBy('meta.id')
      .map((ds: any) => {
        return { text: ds.meta.name, value: ds.meta.id };
      })
      .value();

    dataSourceTypes.unshift({ text: '', value: '' });

    dispatch(toKeyedAction(key, changeVariableEditorExtended({ dataSourceTypes })));
  };
