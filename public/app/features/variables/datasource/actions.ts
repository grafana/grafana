import { chain } from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';
import { stringToJsRegex } from '@grafana/data';

import { DashboardVariableIdentifier } from '../state/types';
import { ThunkResult } from '../../../types';
import { createDataSourceOptions } from './reducer';
import { validateVariableSelectionState } from '../state/actions';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getDashboardVariable } from '../state/selectors';
import { DataSourceVariableModel } from '../types';
import { changeVariableEditorExtended } from '../editor/reducer';
import { toKeyedAction } from '../state/dashboardVariablesReducer';
import { toVariablePayload } from '../utils';

export interface DataSourceVariableActionDependencies {
  getDatasourceSrv: typeof getDatasourceSrv;
}

export const updateDataSourceVariableOptions = (
  identifier: DashboardVariableIdentifier,
  dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrv }
): ThunkResult<void> => async (dispatch, getState) => {
  const { dashboardUid: uid } = identifier;
  const sources = dependencies.getDatasourceSrv().getList({ metrics: true, variables: false });
  const variableInState = getDashboardVariable<DataSourceVariableModel>(identifier, getState());
  let regex;

  if (variableInState.regex) {
    regex = getTemplateSrv().replace(variableInState.regex, undefined, 'regex');
    regex = stringToJsRegex(regex);
  }

  dispatch(toKeyedAction(uid, createDataSourceOptions(toVariablePayload(identifier, { sources, regex }))));
  await dispatch(validateVariableSelectionState(identifier));
};

export const initDataSourceVariableEditor = (
  uid: string,
  dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrv }
): ThunkResult<void> => (dispatch) => {
  const dataSources = dependencies.getDatasourceSrv().getList({ metrics: true, variables: true });
  const dataSourceTypes = chain(dataSources)
    .uniqBy('meta.id')
    .map((ds: any) => {
      return { text: ds.meta.name, value: ds.meta.id };
    })
    .value();

  dataSourceTypes.unshift({ text: '', value: '' });

  dispatch(
    toKeyedAction(
      uid,
      changeVariableEditorExtended({
        propName: 'dataSourceTypes',
        propValue: dataSourceTypes,
      })
    )
  );
};
