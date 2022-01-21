import { cloneDeep } from 'lodash';
import { StoreState, ThunkResult } from 'app/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { changeVariableEditorExtended } from '../editor/reducer';
import { addVariable, changeVariableProp } from '../state/sharedReducer';
import { getNewVariableIndex, getVariable } from '../state/selectors';
import { AddVariable, toVariableIdentifier, toVariablePayload, VariableIdentifier } from '../state/types';
import {
  AdHocVariabelFilterUpdate,
  filterAdded,
  filterRemoved,
  filtersRestored,
  filterUpdated,
  initialAdHocVariableModelState,
} from './reducer';
import { AdHocVariableFilter, AdHocVariableModel } from 'app/features/variables/types';
import { variableUpdated } from '../state/actions';
import { isAdHoc } from '../guard';
import { DataSourceRef, getDataSourceRef } from '@grafana/data';

export interface AdHocTableOptions {
  datasource: DataSourceRef;
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

    const index = variable.filters.findIndex((f) => f.key === options.key && f.value === options.value);

    if (index === -1) {
      const { value, key, operator } = options;
      const filter = { value, key, operator, condition: '' };
      return await dispatch(addFilter(variable.id, filter));
    }

    const filter = { ...variable.filters[index], operator: options.operator };
    return await dispatch(changeFilter(variable.id, { index, filter }));
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

export const changeVariableDatasource = (datasource?: DataSourceRef): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { editor } = getState().templating;
    const variable = getVariable(editor.id, getState());

    const loadingText = 'Ad hoc filters are applied automatically to all queries that target this data source';

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
          propValue: 'This data source does not support ad hoc filters yet.',
        })
      );
    }
  };
};

export const initAdHocVariableEditor = (): ThunkResult<void> => (dispatch) => {
  const dataSources = getDatasourceSrv().getList({ metrics: true, variables: true });
  const selectable = dataSources.reduce(
    (all: Array<{ text: string; value: DataSourceRef | null }>, ds) => {
      if (ds.meta.mixed) {
        return all;
      }

      const text = ds.isDefault ? `${ds.name} (default)` : ds.name;
      const value = getDataSourceRef(ds);
      all.push({ text, value });

      return all;
    },
    [{ text: '', value: {} }]
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
    const index = getNewVariableIndex(getState());
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
    (v) => isAdHoc(v) && v.datasource?.uid === options.datasource.uid
  ) as AdHocVariableModel;
};
