import { type FormEvent, memo, useEffect } from 'react';

import { type DataSourceVariableModel, type SelectableValue, type VariableWithMultiSupport } from '@grafana/data';
import { DataSourceVariableForm } from 'app/features/dashboard-scene/settings/variables/components/DataSourceVariableForm';
import { type StoreState, useDispatch, useSelector } from 'app/types/store';

import { initialVariableEditorState } from '../editor/reducer';
import { getDatasourceVariableEditorState } from '../editor/selectors';
import { type OnPropChangeArguments, type VariableEditorProps } from '../editor/types';
import { changeVariableMultiValue } from '../state/actions';
import { getVariablesState } from '../state/selectors';
import { toKeyedVariableIdentifier } from '../utils';

import { initDataSourceVariableEditor } from './actions';

interface Props extends VariableEditorProps<DataSourceVariableModel> {}

export const DataSourceVariableEditor = memo(function DataSourceVariableEditor({ variable, onPropChange }: Props) {
  const dispatch = useDispatch();

  const extended = useSelector((state: StoreState) => {
    const { rootStateKey } = variable;
    if (!rootStateKey) {
      console.error('DataSourceVariableEditor: variable has no rootStateKey');
      return getDatasourceVariableEditorState(initialVariableEditorState);
    }

    const { editor } = getVariablesState(rootStateKey, state);
    return getDatasourceVariableEditorState(editor);
  });

  useEffect(() => {
    const { rootStateKey } = variable;
    if (!rootStateKey) {
      console.error('DataSourceVariableEditor: variable has no rootStateKey');
      return;
    }

    dispatch(initDataSourceVariableEditor(rootStateKey));
  }, [dispatch, variable]);

  const onRegExBlur = (event: FormEvent<HTMLInputElement>) => {
    onPropChange({
      propName: 'regex',
      propValue: event.currentTarget.value,
      updateOptions: true,
    });
  };

  const onSelectionOptionsChange = ({ propValue, propName }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    onPropChange({ propName, propValue, updateOptions: true });
  };

  const onMultiChanged = (event: FormEvent<HTMLInputElement>) => {
    dispatch(changeVariableMultiValue(toKeyedVariableIdentifier(variable), event.currentTarget.checked));
  };

  const onIncludeAllChanged = (event: FormEvent<HTMLInputElement>) => {
    onSelectionOptionsChange({ propName: 'includeAll', propValue: event.currentTarget.checked });
  };

  const onAllValueChanged = (event: FormEvent<HTMLInputElement>) => {
    onSelectionOptionsChange({ propName: 'allValue', propValue: event.currentTarget.value });
  };

  const onDataSourceTypeChanged = (option: SelectableValue<string>) => {
    onPropChange({ propName: 'query', propValue: option.value, updateOptions: true });
  };

  const typeOptions = extended?.dataSourceTypes?.length
    ? extended.dataSourceTypes?.map((ds) => ({ value: ds.value ?? '', label: ds.text }))
    : [];

  return (
    <DataSourceVariableForm
      query={variable.query}
      regex={variable.regex}
      multi={variable.multi}
      includeAll={variable.includeAll}
      optionTypes={typeOptions}
      onChange={onDataSourceTypeChanged}
      onRegExBlur={onRegExBlur}
      onMultiChange={onMultiChanged}
      onIncludeAllChange={onIncludeAllChanged}
      onAllValueChange={onAllValueChanged}
    />
  );
});
