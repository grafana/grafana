import { useEffect, useCallback, useReducer, ChangeEvent } from 'react';
import { useDebounce } from 'react-use';

import { AppEvents, SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { t } from 'app/core/internationalization';
import { calcFieldsSrv } from 'app/core/services/calcFields_srv';

import { getDsInstanceUrl, getFieldNModule, getColumnsArr, buildValidateQuery } from '../../utils';
import {
  LOAD_START,
  UPDATE_FORMS,
  UPDATE_FIELDS,
  UPDATE_MODULES,
  UPDATE_COLUMNS,
  LOAD_END,
} from '../reducers/actionTypes';
import { modifyReducer, modifyFieldsState } from '../reducers/modifyFields';

export const useModifyFields = (action: string, uid: string | undefined) => {
  useEffect(() => {
    if (!getDsInstanceUrl()) {
      locationService.push({ pathname: '/calculated-fields' });
    }
  }, []);
  const [state, dispatch] = useReducer(modifyReducer, {
    ...modifyFieldsState,
  });

  const getForms = useCallback(async (): Promise<void> => {
    return calcFieldsSrv.getForms(getDsInstanceUrl() || '').then((response: any) => {
      dispatch({ type: UPDATE_FORMS, payload: response.data });
    });
  }, []);

  const getColumns = useCallback(async (formName: string) => {
    return calcFieldsSrv.getColumns(getDsInstanceUrl() || '', formName).then((response: any) => {
      const columns = getColumnsArr(response.data);
      dispatch({ type: UPDATE_COLUMNS, payload: columns });
    });
  }, []);

  const search = async () => {
    dispatch({ type: LOAD_START });
    Promise.all([getForms(), calcFieldsSrv.getFields(getDsInstanceUrl() || '')])
      .then((data: any) => {
        const fields = data[1];
        const [selectedField, modules] = getFieldNModule(fields.results, uid);
        if (selectedField.formName) {
          getColumns(selectedField.formName);
        }
        dispatch({ type: UPDATE_FIELDS, payload: selectedField });
        dispatch({ type: UPDATE_MODULES, payload: modules });
      })
      .finally(() => {
        dispatch({ type: LOAD_END });
      });
  };

  useDebounce(search, 50, [uid, action]);

  const onFormChange = useCallback(
    (selectedVal: SelectableValue) => {
      getColumns(selectedVal.value);
      dispatch({ type: UPDATE_FIELDS, payload: { formName: selectedVal.value } });
    },
    [dispatch, getColumns]
  );

  const onModuleChange = useCallback(
    (selectedVal: SelectableValue) => {
      dispatch({ type: UPDATE_FIELDS, payload: { module: selectedVal.value } });
    },
    [dispatch]
  );

  const onNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      dispatch({ type: UPDATE_FIELDS, payload: { name: event?.target?.value } });
    },
    [dispatch]
  );

  const onQueryChange = useCallback(
    (sqlQuery: string) => {
      dispatch({ type: UPDATE_FIELDS, payload: { sqlQuery } });
    },
    [dispatch]
  );

  const toggleAgg = useCallback(() => {
    dispatch({ type: UPDATE_FIELDS, payload: { Aggregation: !state.fields.Aggregation } });
  }, [dispatch, state.fields.Aggregation]);

  const validateRawQuery = useCallback(() => {
    dispatch({ type: UPDATE_FIELDS, payload: { rawQueryValidated: undefined } });
    const sqlStatement = buildValidateQuery(state.fields);
    calcFieldsSrv
      .validateRawQuery(getDsInstanceUrl() || '', sqlStatement)
      .then((resp: any) => {
        appEvents.emit(AppEvents.alertSuccess, [
          t('bmc.calc-fields.validation-success', 'Query Validated Successfully'),
        ]);
        dispatch({ type: UPDATE_FIELDS, payload: { rawQueryValidated: true } });
      })
      .catch((e: any) => {
        let customErrMsg = t('bmc.calc-fields.unknown-failure', 'Unknown failure');
        if (e.data?.[0]) {
          customErrMsg = `${e.data[0].messageNumber ?? '500'}: ${
            e.data[0].messageText ?? t('bmc.calc-fields.failure', 'Failure')
          }, ${e.data[0].messageAppendedText ?? ''}`;
        }
        appEvents.emit(AppEvents.alertError, [
          t('bmc.calc-fields.query-not-validated', 'Query not validated'),
          customErrMsg,
        ]);
        dispatch({ type: UPDATE_FIELDS, payload: { rawQueryValidated: false } });
      });
  }, [dispatch, state.fields]);

  const createField = useCallback(() => {
    calcFieldsSrv
      .createField({
        name: state.fields.name,
        formName: state.fields.formName,
        module: state.fields.module,
        sqlQuery: state.fields.sqlQuery,
        Aggregation: state.fields.Aggregation,
      })
      .then(() => {
        locationService.push({ pathname: '/calculated-fields' });
      });
  }, [state.fields]);

  const updateField = useCallback(() => {
    calcFieldsSrv
      .updateField({
        fieldId: state.fields.fieldId,
        name: state.fields.name,
        formName: state.fields.formName,
        module: state.fields.module,
        sqlQuery: state.fields.sqlQuery,
        Aggregation: state.fields.Aggregation,
      })
      .then(() => {
        locationService.push({ pathname: '/calculated-fields' });
      });
  }, [state.fields]);

  return {
    forms: state.forms,
    modules: state.modules,
    columns: state.columns,
    fields: state.fields,
    loading: state.loading,
    errMsg: state.errMsg,
    onFormChange,
    onModuleChange,
    onNameChange,
    onQueryChange,
    toggleAgg,
    validateRawQuery,
    createField,
    updateField,
  };
};
