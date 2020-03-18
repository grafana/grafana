import { ThunkResult, StoreState } from 'app/types';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { changeVariableEditorExtended } from '../editor/reducer';
import { changeVariableProp, addVariable } from '../state/sharedReducer';
import { getVariable } from '../state/selectors';
import { toVariablePayload, toVariableIdentifier, AddVariable, VariableIdentifier } from '../state/types';
import {
  AdHocVariabelFilterUpdate,
  filterRemoved,
  filterUpdated,
  filterAdded,
  filtersRestored,
  initialAdHocVariableModelState,
} from './reducer';
import { AdHocVariableFilter, AdHocVariableModel } from 'app/features/templating/variable';
import { variableUpdated } from '../state/actions';
import { isAdHoc } from '../guard';
import { cloneDeep } from 'lodash';

interface AdHocTableOptions {
  datasource: string;
  key: string;
  value: string;
  operator: string;
}

const filterTableName = 'Filters';

export const applyFilterFromTable = (options: AdHocTableOptions): ThunkResult<void> => {
  return (dispatch, getState) => {
    let variable = getVariableByOptions(options, getState());

    if (!variable) {
      dispatch(createAdHocVariable(options));
      variable = getVariableByOptions(options, getState());
    }

    const index = variable.filters.findIndex(f => f.key === options.key && f.value === options.value);

    if (index === -1) {
      const { value, key, operator } = options;
      const filter = { value, key, operator, condition: '' };
      return dispatch(addFilter(variable.uuid, filter));
    }

    const filter = { ...variable.filters[index], operator: options.operator };
    return dispatch(changeFilter(variable.uuid, { index, filter }));
  };
};

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

export const setFiltersFromUrl = (uuid: string, filters: AdHocVariableFilter[]): ThunkResult<void> => {
  return (dispatch, getState) => {
    const variable = getVariable(uuid, getState());
    dispatch(filtersRestored(toVariablePayload(variable, filters)));
    dispatch(variableUpdated(toVariableIdentifier(variable), true));
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

const createAdHocVariable = (options: AdHocTableOptions): ThunkResult<void> => {
  return (dispatch, getState) => {
    const model = {
      ...cloneDeep(initialAdHocVariableModelState),
      datasource: options.datasource,
      name: filterTableName,
    };

    const global = false;
    const index = Object.values(getState().templating.variables).length;
    const identifier: VariableIdentifier = { type: 'adhoc', uuid: null };

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
