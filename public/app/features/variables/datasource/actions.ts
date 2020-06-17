import { toVariablePayload, VariableIdentifier } from '../state/types';
import { ThunkResult } from '../../../types';
import { createDataSourceOptions } from './reducer';
import { validateVariableSelectionState } from '../state/actions';
import { DataSourceSelectItem, stringToJsRegex } from '@grafana/data';
import { getDatasourceSrv } from '../../plugins/datasource_srv';
import { getVariable } from '../state/selectors';
import { DataSourceVariableModel } from '../types';
import templateSrv from '../../templating/template_srv';
import _ from 'lodash';
import { changeVariableEditorExtended } from '../editor/reducer';

export interface DataSourceVariableActionDependencies {
  getDatasourceSrv: typeof getDatasourceSrv;
}

export const updateDataSourceVariableOptions = (
  identifier: VariableIdentifier,
  dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrv }
): ThunkResult<void> => async (dispatch, getState) => {
  const sources = await dependencies.getDatasourceSrv().getMetricSources({ skipVariables: true });
  const variableInState = getVariable<DataSourceVariableModel>(identifier.id, getState());
  let regex;

  if (variableInState.regex) {
    regex = templateSrv.replace(variableInState.regex, undefined, 'regex');
    regex = stringToJsRegex(regex);
  }

  await dispatch(createDataSourceOptions(toVariablePayload(identifier, { sources, regex })));
  await dispatch(validateVariableSelectionState(identifier));
};

export const initDataSourceVariableEditor = (
  dependencies: DataSourceVariableActionDependencies = { getDatasourceSrv: getDatasourceSrv }
): ThunkResult<void> => async dispatch => {
  const dataSources: DataSourceSelectItem[] = await dependencies.getDatasourceSrv().getMetricSources();
  const filtered = dataSources.filter(ds => !ds.meta.mixed && ds.value !== null);
  const dataSourceTypes = _(filtered)
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
