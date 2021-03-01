import _ from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';
import { stringToJsRegex } from '@grafana/data';

import { toVariablePayload, VariableIdentifier } from '../state/types';
import { ThunkResult } from '../../../types';
import { createDataSourceOptions } from './reducer';
import { validateVariableSelectionState } from '../state/actions';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getVariable } from '../state/selectors';
import { DataSourceVariableModel } from '../types';
import { changeVariableEditorExtended } from '../editor/reducer';

export interface DataSourceVariableActionDependencies {
  getDatasourceSrv: typeof getDatasourceSrv;
}

export const updateDataSourceVariableOptions = (
  identifier: VariableIdentifier,
  dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrv }
): ThunkResult<void> => async (dispatch, getState) => {
  const sources = dependencies.getDatasourceSrv().getList({ metrics: true, variables: false });
  const variableInState = getVariable<DataSourceVariableModel>(identifier.id, getState());
  let regex;

  if (variableInState.regex) {
    regex = getTemplateSrv().replace(variableInState.regex, undefined, 'regex');
    regex = stringToJsRegex(regex);
  }

  dispatch(createDataSourceOptions(toVariablePayload(identifier, { sources, regex })));
  await dispatch(validateVariableSelectionState(identifier));
};

export const initDataSourceVariableEditor = (
  dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrv }
): ThunkResult<void> => (dispatch) => {
  const dataSources = dependencies.getDatasourceSrv().getList({ metrics: true, variables: true });
  const dataSourceTypes = _(dataSources)
    .uniqBy('meta.id')
    .map((ds: any) => {
      return { text: ds.meta.name, value: ds.meta.id };
    })
    .value();

  dataSourceTypes.unshift({ text: '', value: '' });

  dispatch(
    changeVariableEditorExtended({
      propName: 'dataSourceTypes',
      propValue: dataSourceTypes,
    })
  );
};
