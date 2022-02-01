import { cloneDeep } from 'lodash';
import { StoreState, ThunkResult } from 'app/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { changeVariableEditorExtended } from '../editor/reducer';
import { addVariable, changeVariableProp } from '../state/sharedReducer';
import {
  getDashboardVariable,
  getDashboardVariablesState,
  getLastKey,
  getNewDashboardVariableIndex,
} from '../state/selectors';
import { AddVariable, DashboardVariableIdentifier } from '../state/types';
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
import { toKeyedAction } from '../state/dashboardVariablesReducer';
import { toDashboardVariableIdentifier, toVariablePayload } from '../utils';

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
      return await dispatch(addFilter(toDashboardVariableIdentifier(variable), filter));
    }

    const filter = { ...variable.filters[index], operator: options.operator };
    return await dispatch(changeFilter(toDashboardVariableIdentifier(variable), { index, filter }));
  };
};

export const changeFilter = (
  identifier: DashboardVariableIdentifier,
  update: AdHocVariabelFilterUpdate
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getDashboardVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.dashboardUid, filterUpdated(toVariablePayload(variable, update))));
    await dispatch(variableUpdated(toDashboardVariableIdentifier(variable), true));
  };
};

export const removeFilter = (identifier: DashboardVariableIdentifier, index: number): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getDashboardVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.dashboardUid, filterRemoved(toVariablePayload(variable, index))));
    await dispatch(variableUpdated(toDashboardVariableIdentifier(variable), true));
  };
};

export const addFilter = (identifier: DashboardVariableIdentifier, filter: AdHocVariableFilter): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getDashboardVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.dashboardUid, filterAdded(toVariablePayload(variable, filter))));
    await dispatch(variableUpdated(toDashboardVariableIdentifier(variable), true));
  };
};

export const setFiltersFromUrl = (
  identifier: DashboardVariableIdentifier,
  filters: AdHocVariableFilter[]
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getDashboardVariable(identifier, getState());
    dispatch(toKeyedAction(identifier.dashboardUid, filtersRestored(toVariablePayload(variable, filters))));
    await dispatch(variableUpdated(toDashboardVariableIdentifier(variable), true));
  };
};

export const changeVariableDatasource = (
  identifier: DashboardVariableIdentifier,
  datasource?: DataSourceRef
): ThunkResult<void> => {
  return async (dispatch, getState) => {
    const variable = getDashboardVariable(identifier, getState());

    const loadingText = 'Ad hoc filters are applied automatically to all queries that target this data source';

    dispatch(
      toKeyedAction(
        identifier.dashboardUid,
        changeVariableEditorExtended({
          propName: 'infoText',
          propValue: loadingText,
        })
      )
    );
    dispatch(
      toKeyedAction(
        identifier.dashboardUid,
        changeVariableProp(toVariablePayload(variable, { propName: 'datasource', propValue: datasource }))
      )
    );

    const ds = await getDatasourceSrv().get(datasource);

    if (!ds || !ds.getTagKeys) {
      dispatch(
        toKeyedAction(
          identifier.dashboardUid,
          changeVariableEditorExtended({
            propName: 'infoText',
            propValue: 'This data source does not support ad hoc filters yet.',
          })
        )
      );
    }
  };
};

export const initAdHocVariableEditor = (uid: string): ThunkResult<void> => (dispatch) => {
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
      uid,
      changeVariableEditorExtended({
        propName: 'dataSources',
        propValue: selectable,
      })
    )
  );
};

const createAdHocVariable = (options: AdHocTableOptions): ThunkResult<void> => {
  return (dispatch, getState) => {
    const uid = getLastKey(getState());

    const model = {
      ...cloneDeep(initialAdHocVariableModelState),
      datasource: options.datasource,
      name: filterTableName,
      id: filterTableName,
      dashboardUid: uid,
    };

    const global = false;
    const index = getNewDashboardVariableIndex(uid, getState());
    const identifier: DashboardVariableIdentifier = { type: 'adhoc', id: model.id, dashboardUid: uid };

    dispatch(
      toKeyedAction(
        uid,
        addVariable(
          toVariablePayload<AddVariable>(identifier, { global, model, index })
        )
      )
    );
  };
};

const getVariableByOptions = (options: AdHocTableOptions, state: StoreState): AdHocVariableModel | undefined => {
  const uid = getLastKey(state);
  const templatingState = getDashboardVariablesState(uid, state);
  return Object.values(templatingState.variables).find(
    (v) => isAdHoc(v) && v.datasource?.uid === options.datasource.uid
  ) as AdHocVariableModel;
};
