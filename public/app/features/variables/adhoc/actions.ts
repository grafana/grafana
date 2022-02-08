import { cloneDeep } from 'lodash';
import { StoreState, ThunkResult } from 'app/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { changeVariableEditorExtended } from '../editor/reducer';
import { addVariable, changeVariableProp } from '../state/sharedReducer';
import { getLastKey, getNewVariableIndex, getVariable, getVariablesState } from '../state/selectors';
import { AddVariable, KeyedVariableIdentifier } from '../state/types';
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
import { getAdhocVariableEditorState } from '../editor/selectors';
import { toKeyedAction } from '../state/keyedVariablesReducer';
import { toKeyedVariableIdentifier, toVariablePayload } from '../utils';

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
      if (!variable) {
        return;
      }
    }

    const index = variable.filters.findIndex((f) => f.key === options.key && f.value === options.value);

    if (index === -1) {
      const { value, key, operator } = options;
      const filter = { value, key, operator, condition: '' };
      return await dispatch(addFilter(toKeyedVariableIdentifier(variable), filter));
    }

    const filter = { ...variable.filters[index], operator: options.operator };
    return await dispatch(changeFilter(toKeyedVariableIdentifier(variable), { index, filter }));
  };
};

export const changeFilter = (
  identifier: KeyedVariableIdentifier,
  update: AdHocVariabelFilterUpdate
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.rootStateKey, filterUpdated(toVariablePayload(variable, update))));
    await dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
  };
};

export const removeFilter = (identifier: KeyedVariableIdentifier, index: number): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.rootStateKey, filterRemoved(toVariablePayload(variable, index))));
    await dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
  };
};

export const addFilter = (identifier: KeyedVariableIdentifier, filter: AdHocVariableFilter): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.rootStateKey, filterAdded(toVariablePayload(variable, filter))));
    await dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
  };
};

export const setFiltersFromUrl = (
  identifier: KeyedVariableIdentifier,
  filters: AdHocVariableFilter[]
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.rootStateKey, filtersRestored(toVariablePayload(variable, filters))));
    await dispatch(variableUpdated(toKeyedVariableIdentifier(variable), true));
  };
};

export const changeVariableDatasource = (
  identifier: KeyedVariableIdentifier,
  datasource?: DataSourceRef
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const { editor } = getVariablesState(identifier.rootStateKey, getState());
    const extended = getAdhocVariableEditorState(editor);
    const variable = getVariable(identifier, getState());
    dispatch(
      toKeyedAction(
        identifier.rootStateKey,
        changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource }))
      )
    );

    const ds = await getDatasourceSrv().get(datasource);

    // TS TODO: ds is not typed to be optional - is this check unnecessary or is the type incorrect?
    const message = ds?.getTagKeys
      ? 'Ad hoc filters are applied automatically to all queries that target this data source'
      : 'This data source does not support ad hoc filters yet.';

    dispatch(
      toKeyedAction(
        identifier.rootStateKey,
        changeVariableEditorExtended({
          infoText: message,
          dataSources: extended?.dataSources ?? [],
        })
      )
    );
  };
};

export const initAdHocVariableEditor =
  (key: string): ThunkResult<void> =>
  (dispatch) => {
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
      toKeyedAction(
        key,
        changeVariableEditorExtended({
          dataSources: selectable,
        })
      )
    );
  };

const createAdHocVariable = (options: AdHocTableOptions): ThunkResult<void> => {
  return (dispatch, getState) => {
    const key = getLastKey(getState());

    const model: AdHocVariableModel = {
      ...cloneDeep(initialAdHocVariableModelState),
      datasource: options.datasource,
      name: filterTableName,
      id: filterTableName,
      rootStateKey: key,
    };

    const global = false;
    const index = getNewVariableIndex(key, getState());
    const identifier: KeyedVariableIdentifier = { type: 'adhoc', id: model.id, rootStateKey: key };

    dispatch(toKeyedAction(key, addVariable(toVariablePayload<AddVariable>(identifier, { global, model, index }))));
  };
};

const getVariableByOptions = (options: AdHocTableOptions, state: StoreState): AdHocVariableModel | undefined => {
  const key = getLastKey(state);
  const templatingState = getVariablesState(key, state);
  return Object.values(templatingState.variables).find(
    (v) => isAdHoc(v) && v.datasource?.uid === options.datasource.uid
  ) as AdHocVariableModel;
};
