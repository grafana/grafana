import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

import { useDispatch } from '../../hooks/useStatelessReducer';
import { EditorType } from '../../types';

import { useQuery } from './ElasticsearchQueryContext';
import { changeEditorTypeAndResetQuery } from './state';

const BASE_OPTIONS: Array<SelectableValue<EditorType>> = [
  { value: 'builder', label: 'Builder' },
  { value: 'code', label: 'Code' },
];

export const EditorTypeSelector = () => {
  const query = useQuery();
  const dispatch = useDispatch();

  // Default to 'builder' if editorType is empty
  const editorType: EditorType = query.editorType === 'code' ? 'code' : 'builder';

  const onChange = (newEditorType: EditorType) => {
    dispatch(changeEditorTypeAndResetQuery(newEditorType));
  };

  return (
      <RadioButtonGroup<EditorType> size="sm" options={BASE_OPTIONS} value={editorType} onChange={onChange} />
  );
};
