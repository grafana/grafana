import { memo, useEffect } from 'react';

import { type AdHocVariableModel, type DataSourceInstanceSettings, getDataSourceRef } from '@grafana/data';
import { AdHocVariableForm } from 'app/features/dashboard-scene/settings/variables/components/AdHocVariableForm';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { initialVariableEditorState } from '../editor/reducer';
import { getAdhocVariableEditorState } from '../editor/selectors';
import { type VariableEditorProps } from '../editor/types';
import { getVariablesState } from '../state/selectors';
import { toKeyedVariableIdentifier } from '../utils';

import { changeVariableDatasource } from './actions';

interface Props extends VariableEditorProps<AdHocVariableModel> {}

export const AdHocVariableEditor = memo(function AdHocVariableEditor({ variable }: Props) {
  const dispatch = useDispatch();

  const extended = useSelector((state: StoreState) => {
    const { rootStateKey } = variable;

    if (!rootStateKey) {
      return getAdhocVariableEditorState(initialVariableEditorState);
    }

    const { editor } = getVariablesState(rootStateKey, state);
    return getAdhocVariableEditorState(editor);
  });

  useEffect(() => {
    if (!variable.rootStateKey) {
      console.error('AdHocVariableEditor: variable has no rootStateKey');
    }
  }, [variable.rootStateKey]);

  const onDatasourceChanged = (ds: DataSourceInstanceSettings) => {
    dispatch(changeVariableDatasource(toKeyedVariableIdentifier(variable), getDataSourceRef(ds)));
  };

  return (
    <AdHocVariableForm
      datasource={variable.datasource ?? undefined}
      onDataSourceChange={onDatasourceChanged}
      infoText={extended?.infoText}
      datasourceSupported={variable.datasource === undefined ? false : true} // legacy behavior - will show data source settings even if not supported
    />
  );
});
