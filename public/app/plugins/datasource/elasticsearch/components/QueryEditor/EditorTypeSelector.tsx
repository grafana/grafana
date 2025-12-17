import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

import { EditorType } from '../../types';

const BASE_OPTIONS: Array<SelectableValue<EditorType>> = [
  { value: 'builder', label: 'Builder' },
  { value: 'code', label: 'Code' },
];

interface Props {
  value: EditorType;
  onChange: (editorType: EditorType) => void;
}

export const EditorTypeSelector = ({ value, onChange }: Props) => {
  return (
    <div data-testid="ElasticsearchEditorTypeToggle">
      <RadioButtonGroup<EditorType> size="sm" options={BASE_OPTIONS} value={value} onChange={onChange} />
    </div>
  );
};
