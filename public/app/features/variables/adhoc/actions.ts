import { cloneDeep } from 'lodash';
import { StoreState, ThunkResult } from 'app/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { changeVariableEditorExtended } from '../editor/reducer';
import { addVariable, changeVariableProp } from '../state/sharedReducer';
import { getNewVariabelIndex, getVariable } from '../state/selectors';
import { AddVariable, toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import {
  AdHocVariabelFilterUpdate,
  filterAdded,
  filterRemoved,
  filtersRestored,
  filterUpdated,
  initialAdHocVariableModelState,
} from './reducer';
import { AdHocVariableFilter, AdHocVariableModel } from 'app/features/templating/types';
import { variableUpdated } from '../state/actions';
import { isAdHoc } from '../guard';

export interface AdHocTableOptions {
  datasource: string;
  key: string;
  value: string;
  operator: string;
}

const filterTableName = 'Filters';

export const applyFilterFromTable = (options: AdHocTableOptions): ThunkResult<void> => {
  return async (dispatch, getState) => {
    let variable = getVariableByOptions(options, getState());

    if (!variable) {
      dispatch(createAdHocVariable(options));
      variable = getVariableByOptions(options, getState());
    }

    const index = variable.filters.findIndex(f => f.key === options.key && f.value === options.value);

    if (index === -1) {
      const { value, key, operator } = options;
      const filter = { value, key, operator, condition: '' };
      return await dispatch(addFilter(variable.id!, filter));
    }

    const filter = { ...variable.filters[index], operator: options.operator };
    return await dispatch(changeFilter(variable.id!, { index, filter }));
  };
};

export const changeFilter = (id: string, update: AdHocVariabelFilterUpdate): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(id, getState());
    dispatch(filterUpdated(toVariablePayload(variable, update)));
    await dispatch(variableUpdated(toVariableIdentifier(variable), true));
  };
};

export const removeFilter = (id: string, index: number): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(id, getState());
    dispatch(filterRemoved(toVariablePayload(variable, index)));
    await dispatch(variableUpdated(toVariableIdentifier(variable), true));
  };
};

export const addFilter = (id: string, filter: AdHocVariableFilter): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(id, getState());
    dispatch(filterAdded(toVariablePayload(variable, filter)));
    await dispatch(variableUpdated(toVariableIdentifier(variable), true));
  };
};

export const setFiltersFromUrl = (id: string, filters: AdHocVariableFilter[]): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(id, getState());
    dispatch(filtersRestored(toVariablePayload(variable, filters)));
    await dispatch(variableUpdated(toVariableIdentifier(variable), true));
  };
};

export const changeVariableDatasource = (datasource: string): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { editor } = getState().templating;
    const variable = getVariable(editor.id, getState());

    const loadingText = 'Adhoc filters are applied automatically to all queries that target this datasource';

    dispatch(
      changeVariableEditorExtended({
        propName: 'infoText',
        propValue: loadingText,
      })
    );
    dispatch(changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource })));

    const ds = await getDatasourceSrv().get(datasource);

    if (!ds || !ds.getTagKeys) {
      dispatch(
        changeVariableEditorExtended({
          propName: 'infoText',
          propValue: 'This datasource does not support adhoc filters yet.',
        })
      );
    }
  };
};

export const initAdHocVariableEditor = (): ThunkResult<void> => dispatch => {
  const dataSources = getDatasourceSrv().getMetricSources();
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

const createAdHocVariable = (options: AdHocTableOptions): ThunkResult<void> => {
  return (dispatch, getState) => {
    const model = {
      ...cloneDeep(initialAdHocVariableModelState),
      datasource: options.datasource,
      name: filterTableName,
      id: filterTableName,
    };

    const global = false;
    const index = getNewVariabelIndex(getState());
    const identifier: VariableIdentifier = { type: 'adhoc', id: model.id };

    dispatch(
      addVariable(
        toVariablePayload<AddVariable>(identifier, { global, model, index })
      )
    );
  };
};

const getVariableByOptions = (options: AdHocTableOptions, state: StoreState): AdHocVariableModel => {
  return Object.values(state.templating.variables).find(
    v => isAdHoc(v) && v.datasource === options.datasource
  ) as AdHocVariableModel;
};
