import { PropsWithChildren, useMemo } from 'react';

import { SelectableValue, VariableType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from 'app/core/internationalization';

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
    // BMC Change: To enable localization for below text

    <VariableSelectField
      name={t('bmcgrafana.dashboards.settings.variables.editor.select-variable-type-text', 'Select variable type')}
      value={value}
      options={options}
      onChange={onChange}
      testId={selectors.pages.Dashboard.Settings.Variables.Edit.General.generalTypeSelectV2}
    />
  );
}
