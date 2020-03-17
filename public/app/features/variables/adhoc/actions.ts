import { ThunkResult } from 'app/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { changeVariableEditorExtended, changeEditorInfoText } from '../editor/reducer';
import { changeVariableProp } from '../state/sharedReducer';
import { getVariable } from '../state/selectors';
import { toVariablePayload, toVariableIdentifier } from '../state/types';
import { AdHocVariabelFilterUpdate, filterRemoved, filterUpdated, filterAdded } from './reducer';
import { AdHocVariableFilter } from 'app/features/templating/variable';
import { variableUpdated } from '../state/actions';

export const changeFilter = (uuid: string, update: AdHocVariabelFilterUpdate): ThunkResult<void> => {
  return (dispatch, getState) => {
    const variable = getVariable(uuid, getState());
    dispatch(filterUpdated(toVariablePayload(variable, update)));
    dispatch(variableUpdated(toVariableIdentifier(variable), true));
  };
};

export const removeFilter = (uuid: string, index: number): ThunkResult<void> => {
  return (dispatch, getState) => {
    const variable = getVariable(uuid, getState());
    dispatch(filterRemoved(toVariablePayload(variable, index)));
    dispatch(variableUpdated(toVariableIdentifier(variable), true));
  };
};

export const addFilter = (uuid: string, filter: AdHocVariableFilter): ThunkResult<void> => {
  return (dispatch, getState) => {
    const variable = getVariable(uuid, getState());
    dispatch(filterAdded(toVariablePayload(variable, filter)));
    dispatch(variableUpdated(toVariableIdentifier(variable), true));
  };
};

export const changeVariableDatasource = (datasource: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { editor } = getState().templating;
    const variable = getVariable(editor.id, getState());

    const loadingText = 'Adhoc filters are applied automatically to all queries that target this datasource';

    dispatch(changeEditorInfoText(loadingText));
    dispatch(changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource })));

    const ds = await getDatasourceSrv().get(datasource);

    if (!ds || !ds.getTagKeys) {
      dispatch(changeEditorInfoText('This datasource does not support adhoc filters yet.'));
    }
  };
};

export const initAdHocVariableEditor = (): ThunkResult<void> => async dispatch => {
  const dataSources = await getDatasourceSrv().getMetricSources();
  const selectable = dataSources.reduce(
    (all: Array<{ text: string; value: string }>, ds) => {
      if (ds.meta.mixed || ds.value === null) {
        return all;
      }

      all.push({
        text: ds.name,
        value: ds.value,
      });

      return all;
    },
    [{ text: '', value: '' }]
  );

  dispatch(
    changeVariableEditorExtended({
      propName: 'dataSources',
      propValue: selectable,
    })
  );
};
