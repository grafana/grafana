import { PropsWithChildren, useMemo } from 'react';

import { SelectableValue, VariableType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { VariableSelectField } from '../../dashboard-scene/settings/variables/components/VariableSelectField';
import { getVariableTypes } from '../utils';

interface Props {
  onChange: (option: SelectableValue<VariableType>) => void;
  type: VariableType;
}

export function VariableTypeSelect({ onChange, type }: PropsWithChildren<Props>) {
  const options = useMemo(() => getVariableTypes(), []);
  const value = useMemo(() => options.find((o) => o.value === type) ?? options[0], [options, type]);

  return (
    <VariableSelectField
      name={t('variables.variable-type-select.name-select-variable-type', 'Select variable type')}
      value={value}
      options={options}
      onChange={onChange}
      testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2}
    />
  );
}
