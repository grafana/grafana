import { type PropsWithChildren, useMemo } from 'react';

import { type SelectableValue, type VariableType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { VariableSelectField } from 'app/features/dashboard-scene/settings/variables/components/VariableSelectField';

import { type EditableVariableType, getVariableTypeSelectOptions } from '../utils';

interface Props {
  onChange: (option: SelectableValue<EditableVariableType>) => void;
  type: VariableType;
  /** True when rendering outside a dashboard (e.g. the variables management page). */
  standalone?: boolean;
}

export function VariableTypeSelect({ onChange, type, standalone }: PropsWithChildren<Props>) {
  const options = useMemo(() => getVariableTypeSelectOptions({ standalone }), [standalone]);
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
