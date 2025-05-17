import { PropsWithChildren, useMemo } from 'react';

import { SelectableValue, VariableType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { VariableSelectField } from 'app/features/dashboard-scene/settings/variables/components/VariableSelectField';

import { EditableVariableType, getVariableTypeSelectOptions } from '../utils';

interface Props {
  onChange: (option: SelectableValue<EditableVariableType>) => void;
  type: VariableType;
}

export function VariableTypeSelect({ onChange, type }: PropsWithChildren<Props>) {
  const options = useMemo(() => getVariableTypeSelectOptions(), []);
  const value = useMemo(
    () => options.find((o: SelectableValue<EditableVariableType>) => o.value === type) ?? options[0],
    [options, type]
  );

  return (
    <VariableSelectField
      name="Variable type"
      value={value}
      options={options}
      onChange={onChange}
      testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2}
    />
  );
}
