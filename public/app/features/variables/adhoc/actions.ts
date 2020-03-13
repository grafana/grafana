import { ThunkResult } from 'app/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { changeVariableEditorExtended, changeEditorInfoText } from '../editor/reducer';
import { changeVariableProp } from '../state/sharedReducer';
import { getVariable } from '../state/selectors';
import { toVariablePayload } from '../state/types';

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
