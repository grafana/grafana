import { type PropsWithChildren, useMemo } from 'react';

import type { SelectableValue, VariableType } from '@grafana/data/types';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { VariableSelectField } from 'app/features/dashboard-scene/settings/variables/components/VariableSelectField';

import { type EditableVariableType, getVariableTypeSelectOptions } from '../utils';

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
      name={t('dashboard-scene.variable-type-select.name-variable-type', 'Variable type')}
      value={value}
      options={options}
      onChange={onChange}
      testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2}
    />
  );
}
