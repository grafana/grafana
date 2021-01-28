import React, { PropsWithChildren, useMemo } from 'react';
import { SelectableValue, VariableType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { VariableSelectField } from '../editor/VariableSelectField';
import { getVariableTypes } from '../utils';
import { variableAdapters } from '../adapters';

interface Props {
  onChange: (option: SelectableValue<VariableType>) => void;
  type: VariableType;
}

export function VariableTypeSelect({ onChange, type }: PropsWithChildren<Props>) {
  const options = useMemo(() => getVariableTypes(), [getVariableTypes]);
  const value = useMemo(() => options.find((o) => o.value === type) ?? options[0], [options, type]);

  return (
    <VariableSelectField
      name="Type"
      value={value}
      options={options}
      onChange={onChange}
      tooltip={variableAdapters.get(type).description}
      ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelect}
    />
  );
}
