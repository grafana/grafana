import { useId } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';

interface Props {
  columns: Array<SelectableValue<string>>;
  onParameterChange: (value?: string) => void;
  value: SelectableValue<string> | null;
}

export function SelectColumn({ columns, onParameterChange, value }: Props) {
  const selectInputId = useId();

  return (
    <EditorField label="Column" width={25}>
      <Select
        value={value}
        data-testid={selectors.components.SQLQueryEditor.selectColumn}
        inputId={selectInputId}
        menuShouldPortal
        options={[{ label: '*', value: '*' }, ...columns]}
        allowCustomValue
        onChange={(s) => onParameterChange(s.value)}
      />
    </EditorField>
  );
}
